"""
backend/apps/recommendations/views.py
=======================================
Endpoints Django — recommandations SmartShop (Sprint S3 v4)

PUBLIC (visiteur non connecté) :
  GET  /api/recommendations/trending/        → produits tendances
  GET  /api/recommendations/similar/         → "vous aimerez aussi"
  GET  /api/recommendations/bought-together/ → "achetés ensemble"

AUTHENTIFIÉ :
  GET  /api/recommendations/                 → recommandations personnalisées
"""
import logging
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
import httpx

from apps.products.models import Product

logger = logging.getLogger(__name__)
ML_URL = getattr(settings, "ML_SERVICE_URL", "http://localhost:8001")


def _prod_dict(p: Product, score, reason: str) -> dict:
    thumb = None
    if hasattr(p, "images") and p.images.exists():
        img = p.images.order_by("-is_primary", "order").first()
        if img:
            thumb = img.image.url
    return {
        "id": p.id, "name": p.name, "slug": p.slug,
        "price": str(p.price),
        "original_price": str(p.original_price) if p.original_price else None,
        "image": thumb,
        "category": p.category.name if p.category else None,
        "category_slug": p.category.slug if p.category else None,
        "average_rating": float(p.average_rating or 0),
        "review_count": p.review_count or 0,
        "stock_quantity": p.stock_quantity,
        "status": p.status,
        "ml_score": round(score, 3) if score is not None else None,
        "recommendation_reason": reason,
    }


def _reason(src: str, known: bool) -> str:
    if src == "real_db" and known:   return "Basé sur votre historique SmartShop"
    if src == "kaggle" and known:    return "Basé sur des comportements similaires"
    if src == "trending":            return "Tendance sur SmartShop"
    return "Recommandé pour vous"


class PersonalizedRecommendationsView(APIView):
    """GET /api/recommendations/?n=10 — AUTHENTIFIÉ."""
    permission_classes = [AllowAny]

    def get(self, request):
        # Visiteur non authentifié → fallback produits populaires directement
        if not request.user.is_authenticated:
            n = int(request.query_params.get("n", 10))
            return self._fallback(n)
        user_id = str(request.user.id)
        n       = int(request.query_params.get("n", 10))
        cat     = request.query_params.get("category")

        payload = {"user_id": user_id, "n": n, "exclude_rated": True}
        if cat: payload["category"] = cat

        try:
            with httpx.Client(timeout=30) as c:
                resp = c.post(f"{ML_URL}/ml/recommend", json=payload)
                resp.raise_for_status()
                ml = resp.json()
        except Exception as e:
            logger.warning("ML service: %s → fallback", e)
            return self._fallback(n)

        recs      = ml.get("recommendations", [])
        src       = ml.get("data_source", "kaggle")
        known     = ml.get("user_known", False)
        reason    = _reason(src, known)

        prods = list(Product.objects.filter(status="ACTIVE", stock_quantity__gt=0)
                     .select_related("category").prefetch_related("images")[:200])

        result = []
        for i, p in enumerate(prods[:n]):
            sc = recs[i]["score"] if i < len(recs) else None
            result.append(_prod_dict(p, sc, reason))

        return Response({
            "user_id": user_id, "user_known": known,
            "alpha_svd": ml.get("alpha_svd"), "alpha_cf": ml.get("alpha_cf"),
            "data_source": src, "count": len(result), "results": result,
        })

    def _fallback(self, n):
        from django.db.models import Count
        from apps.orders.models import OrderItem
        ids = (OrderItem.objects.values("product_id")
               .annotate(c=Count("id")).order_by("-c")
               .values_list("product_id", flat=True)[:n*2])
        prods = Product.objects.filter(id__in=ids, status="ACTIVE")
        return Response({
            "data_source": "fallback_popular", "count": prods.count(),
            "results": [_prod_dict(p, None, "Populaire sur SmartShop") for p in prods[:n]],
        })


class TrendingView(APIView):
    """
    GET /api/recommendations/trending/?n=12
    PUBLIC — visiteur non connecté.
    Retourne les produits tendances (popularité Kaggle + commandes réelles).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        n   = int(request.query_params.get("n", 12))
        cat = request.query_params.get("category")
        params = {"n": n}
        if cat: params["category"] = cat

        try:
            with httpx.Client(timeout=15) as c:
                resp = c.get(f"{ML_URL}/ml/trending", params=params)
                resp.raise_for_status()
                trend_data = resp.json()
        except Exception as e:
            logger.warning("ML trending: %s → fallback popular", e)
            trend_data = []

        # Enrichir avec produits Django
        prods = list(Product.objects.filter(status="ACTIVE", stock_quantity__gt=0)
                     .select_related("category").prefetch_related("images")[:n*2])

        result = []
        for i, p in enumerate(prods[:n]):
            if isinstance(trend_data, list):
                sc = trend_data[i].get("popularity_score") if i < len(trend_data) else None
            else:
                sc = None
            if isinstance(trend_data, dict):
                sc = trend_data.get(str(i), {}).get("popularity_score")

            result.append(_prod_dict(p, sc, "Tendance sur SmartShop"))

        return Response({"count": len(result), "results": result})


class SimilarProductsView(APIView):
    """
    GET /api/recommendations/similar/?product_id=42&n=5
    PUBLIC — visiteur + authentifié. Section "Vous aimerez aussi".
    """
    permission_classes = [AllowAny]

    def get(self, request):
        pid = request.query_params.get("product_id")
        n   = int(request.query_params.get("n", 5))
        if not pid:
            return Response({"error": "product_id requis"}, status=400)

        try:
            pidx = int(pid) % 2000
        except ValueError:
            return Response({"error": "product_id invalide"}, status=400)

        try:
            with httpx.Client(timeout=10) as c:
                resp = c.post(f"{ML_URL}/ml/similar-products",
                              json={"product_idx": pidx, "n": n})
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.warning("ML similar: %s", e)
            return Response({"results": []})

        return Response({"product_id": pid, "results": data.get("similar", [])})


class BoughtTogetherView(APIView):
    """
    GET /api/recommendations/bought-together/?product_id=42&n=5
    PUBLIC — inspiré Amazon "Fréquemment achetés ensemble".
    Source 1 : BD SmartShop réelle (même commande)
    Source 2 : Fallback CB TF-IDF si pas assez de données
    """
    permission_classes = [AllowAny]

    def get(self, request):
        pid = request.query_params.get("product_id")
        n   = int(request.query_params.get("n", 5))
        if not pid:
            return Response({"error": "product_id requis"}, status=400)

        try:
            with httpx.Client(timeout=10) as c:
                resp = c.post(f"{ML_URL}/ml/bought-together",
                              json={"product_id": str(pid), "n": n})
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.warning("ML bought-together: %s", e)
            return Response({"product_id": pid, "source": "unavailable", "together": []})

        return Response(data)