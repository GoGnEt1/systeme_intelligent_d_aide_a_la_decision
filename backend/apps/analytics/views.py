"""
=============================================================
 backend/apps/analytics/views.py  — Sprint S4
 
 Endpoints Django pour la segmentation RFM + offres cadeaux.
 Django délègue le calcul ML à FastAPI (port 8001).
 
 Endpoints :
   GET  /api/analytics/customers/           → liste clients segmentés
   GET  /api/analytics/segments-stats/      → stats globales
   POST /api/analytics/gifts/               → créer offre cadeau (admin)
   GET  /api/analytics/gifts/<token>/       → voir offre (client, via email)
   POST /api/analytics/gifts/<token>/respond/ → accepter/refuser (client)
   POST /api/analytics/resegment/           → déclencher resegmentation (admin)
=============================================================
"""

import logging
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.template.loader import render_to_string
from django.db.models import Sum, Count, Avg
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
import httpx
from django.db import models

from apps.orders.models import Order
from apps.users.models import User

try:
    from .models import CustomerSegment, GiftOffer
except ImportError:
    CustomerSegment = None
    GiftOffer = None

logger = logging.getLogger(__name__)
ML_URL = getattr(settings, "ML_SERVICE_URL", "http://localhost:8001")

# ── Helpers ───────────────────────────────────────────────────────────────────

def _call_ml(path: str, method="GET", **kwargs) -> dict:
    """Appel au microservice FastAPI ML."""
    url = f"{ML_URL}{path}"
    try:
        with httpx.Client(timeout=30) as c:
            if method == "GET":
                resp = c.get(url, **kwargs)
            else:
                resp = c.post(url, **kwargs)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.warning("ML Service inaccessible [%s %s] : %s", method, path, e)
        return {}


def _send_gift_email(gift_offer: "GiftOffer"):
    """
    Envoie l'email de notification au client pour son offre cadeau.
    
    Inclut un lien sécurisé avec le token unique pour accepter/refuser.
    """
    from django.template.loader import render_to_string
    from django.utils.html import strip_tags
    from django.utils import timezone as tz

    accept_url  = f"{settings.FRONTEND_URL}/gifts/{gift_offer.token}/accept"
    decline_url = f"{settings.FRONTEND_URL}/gifts/{gift_offer.token}/decline"

    gift_type_labels = {
        "discount": f"🎉 Réduction de {gift_offer.gift_value}%",
        "product":  "🎁 Article offert",
        "shipping": "🚚 Livraison gratuite",
        "points":   f"⭐ {gift_offer.gift_value:.0f} points fidélité",
        "voucher":  f"💳 Bon d'achat de {gift_offer.gift_value} DT",
    }
    gift_icons = {
        "discount": "🏷️", "product": "🎁", "shipping": "🚚",
        "points": "⭐", "voucher": "💳",
    }
    gift_label = gift_type_labels.get(gift_offer.gift_type, "Cadeau exclusif")

    context = {
        "first_name":   gift_offer.user.first_name,
        "gift_label":   gift_label,
        "gift_icon":    gift_icons.get(gift_offer.gift_type, "🎁"),
        "gift_details": gift_offer.gift_details,
        "gift_type":    gift_offer.gift_type,
        "gift_value":   gift_offer.gift_value,
        "valid_days":   gift_offer.valid_days,
        "accept_url":   accept_url,
        "decline_url":  decline_url,
        "year":         tz.now().year,
        "base_url":     getattr(settings, "FRONTEND_URL", "http://localhost:5173"),
    }

    subject   = f"SmartShop — Votre cadeau exclusif : {gift_label}"
    html_body = render_to_string("gift_offer.html", context)
    plain_body = strip_tags(html_body)

    try:
        from django.core.mail import EmailMultiAlternatives
        msg = EmailMultiAlternatives(
            subject=subject,
            body=plain_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[gift_offer.user.email],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        logger.info("📧 Email cadeau envoyé à %s", gift_offer.user.email)
        return True
    except Exception as e:
        logger.error("❌ Erreur envoi email cadeau : %s", e)
        return False


# ── VUES ─────────────────────────────────────────────────────────────────────

class CustomerListView(APIView):
    """
    GET /api/analytics/customers/
    
    Retourne la liste de tous les clients segmentés, triable.
    
    Query params :
    - sort_by : "segment" (défaut) | "monetary" | "orders"
    - segment : filtrer par segment (champions, loyaux, a_risque_perdus)
    - quarter_offset : 0 = trimestre actuel, -1 = précédent
    - page, page_size : pagination
    
    Requiert : admin
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        sort_by       = request.query_params.get("sort_by", "segment")
        segment_filter= request.query_params.get("segment")
        quarter_offset= int(request.query_params.get("quarter_offset", 0))
        page          = int(request.query_params.get("page", 1))
        page_size     = int(request.query_params.get("page_size", 50))

        ml_data = _call_ml(
            "/ml/segments-list",
            params={
                "segment":   segment_filter or "",
                "page":      page,
                "page_size": min(page_size, 500),
            }
        )
        customers = ml_data.get("customers", [])

        # Si segments-list vide, tenter top-customers avec fenêtre élargie
        if not customers:
            ml_data = _call_ml(
                "/ml/top-customers",
                params={
                    "sort_by":        sort_by,
                    "segment":        segment_filter or "",
                    "quarter_offset": quarter_offset,
                    "limit":          500,
                }
            )
            customers = ml_data.get("customers", [])

        # ── Fallback RFM Django ORM ───────────────────────────────────────────
        # Si le ML service est indisponible OU n'a pas encore de données,
        # on calcule un classement RFM simplifié depuis les commandes DELIVERED.
        # Ceci permet de tester "Lancer la campagne" sans données ML réelles.
        # NOTE : cette option sera désactivée quand les données réelles seront suffisantes.
        if not customers:
            from django.db.models import Sum, Count, Max
            from django.utils import timezone
            import datetime

            now = timezone.now()
            # FIX : Fenêtre élargie à 12 mois (le filtre trimestriel retournait 0
            # résultats quand les commandes du seeding étaient hors de Q2 2026).
            twelve_months_ago = now - datetime.timedelta(days=365)

            qs = (
                Order.objects.filter(
                    status__in=["DELIVERED", "SHIPPED", "PROCESSING", "CONFIRMED"],
                    created_at__gte=twelve_months_ago,
                )
                .values("user_id", "user__email", "user__first_name", "user__last_name")
                .annotate(
                    order_count=Count("id"),
                    total_spent=Sum("total_amount"),
                    last_order_date=Max("created_at"),
                )
                .order_by("-total_spent")[:500]
            )

            for i, row in enumerate(qs):
                uid = str(row["user_id"])
                recency_days = (now - row["last_order_date"]).days

                # Segment RFM simplifié basé sur les métriques disponibles
                freq = row["order_count"]
                monetary = float(row["total_spent"] or 0)
                if recency_days <= 30 and freq >= 3 and monetary >= 800:
                    seg, seg_label, cid, color = "champions", "Champions", 0, "#10B981"
                elif recency_days <= 60 and freq >= 2:
                    seg, seg_label, cid, color = "loyaux", "Clients Loyaux", 1, "#3B82F6"
                else:
                    seg, seg_label, cid, color = "a_risque_perdus", "À Risque", 2, "#F59E0B"
                # else:
                #     seg, seg_label, cid, color = "perdus", "Clients Perdus", 3, "#EF4444"

                if segment_filter and seg != segment_filter:
                    continue

                customers.append({
                    "rank":          i + 1,
                    "user_id":       uid,
                    "email":         row["user__email"],
                    "first_name":    row["user__first_name"],
                    "last_name":     row["user__last_name"],
                    "order_count":   freq,
                    "total_spent":   round(monetary, 2),
                    "avg_order":     round(monetary / freq, 2) if freq else 0,
                    "last_order":    row["last_order_date"].isoformat(),
                    "cluster_id":    cid,
                    "segment":       seg,
                    "segment_label": seg_label,
                    "color":         color,
                    "recency_days":  recency_days,
                    "frequency":     freq,
                    "monetary":      monetary,
                    "avg_order_value": round(monetary / freq, 2) if freq else 0,
                    "computed_at":   now.isoformat(),
                    "_source":       "rfm_fallback",
                })

            ml_data["_fallback"] = True
        # ── Fin fallback ──────────────────────────────────────────────────────

        # Enrichir avec info d'offre cadeau existante
        user_ids = [c["user_id"] for c in customers]
        if GiftOffer and user_ids:
            existing_gifts = GiftOffer.objects.filter(
                user_id__in=user_ids,
                status__in=["pending", "sent", "accepted"]
            ).values("user_id", "status", "gift_type", "id")
            gift_map = {str(g["user_id"]): g for g in existing_gifts}
            for c in customers:
                gift = gift_map.get(c["user_id"])
                c["existing_gift"] = {
                    "id":         gift["id"],
                    "status":     gift["status"],
                    "gift_type":  gift["gift_type"],
                } if gift else None

        # Pagination
        total = len(customers)
        start = (page - 1) * page_size
        end   = start + page_size
        page_data = customers[start:end]

        return Response({
            "total":          total,
            "page":           page,
            "page_size":      page_size,
            "pages":          (total + page_size - 1) // page_size,
            "sort_by":        sort_by,
            "quarter_start":  ml_data.get("quarter_start"),
            "quarter_end":    ml_data.get("quarter_end"),
            "customers":      page_data,
            "_fallback":      ml_data.get("_fallback", False),
        })


class SegmentsStatsView(APIView):
    """
    GET /api/analytics/segments-stats/
    
    Statistiques globales de segmentation pour le dashboard.
    Données : nb clients, R/F/M moyens, % CA par segment.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        ml_data = _call_ml("/ml/segments-stats")

        if not ml_data:
            if CustomerSegment:
                fallback = CustomerSegment.objects.values(
                    "cluster_id", "segment", "segment_label"
                ).annotate(
                    n_clients=Count("id"),
                    recency_avg=Avg("recency_days"),
                    frequency_avg=Avg("frequency"),
                    monetary_avg=Avg("monetary"),
                    monetary_total=Sum("monetary"),
                )
                return Response({"segments": list(fallback), "source": "django_orm"})
            return Response({"segments": [], "error": "ML service unavailable"})

        return Response(ml_data)


class CustomerSegmentView(APIView):
    """
    GET /api/analytics/segment/<user_id>/
    
    Segment RFM d'un client spécifique.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, user_id):
        ml_data = _call_ml(f"/ml/segment", params={"user_id": str(user_id)})
        if not ml_data:
            return Response({"error": "ML service unavailable"}, status=503)
        return Response(ml_data)


class GiftOfferCreateView(APIView):
    """
    POST /api/analytics/gifts/
    
    Créer une offre cadeau pour un client (admin uniquement).
    
    Body :
    {
        "user_id":    "42",
        "gift_type":  "discount",
        "gift_value": 20.0,
        "gift_details": "Réduction exclusive -20% sur votre prochain achat",
        "valid_days": 7,
        "admin_note": "Client champion Q1 2026"
    }
    
    Action : crée l'offre EN BD, envoie l'email, retourne l'objet créé.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        if not GiftOffer:
            return Response({"error": "Module GiftOffer non disponible"}, status=501)

        data = request.data

        # Validation
        required = ["user_id", "gift_type", "gift_value", "gift_details"]
        for field in required:
            if field not in data:
                return Response({"error": f"Champ requis : {field}"}, status=400)

        # Récupérer le client
        try:
            user = User.objects.get(id=int(data["user_id"]))
        except (User.DoesNotExist, ValueError):
            return Response({"error": "Client introuvable"}, status=404)

        # Vérifier qu'il n'y a pas déjà une offre active
        existing = GiftOffer.objects.filter(
            user=user,
            status__in=["pending", "sent"]
        ).first()
        if existing:
            return Response({
                "error": "Ce client a déjà une offre en cours",
                "existing_gift_id": existing.id,
                "status": existing.status,
            }, status=409)

        # Récupérer le segment actuel
        segment_info = _call_ml(f"/ml/segment", params={"user_id": str(user.id)})
        segment = segment_info.get("segment", "inconnu")

        # Créer l'offre
        gift = GiftOffer.objects.create(
            user=user,
            segment=segment,
            rank=int(data.get("rank", 0)),
            gift_type=data["gift_type"],
            gift_value=float(data["gift_value"]),
            gift_details=data["gift_details"],
            admin_note=data.get("admin_note", ""),
            valid_days=int(data.get("valid_days", 7)),
            status=GiftOffer.Status.PENDING,
        )

        # Envoyer l'email et mettre à jour le statut
        sent = _send_gift_email(gift)
        if sent:
            gift.status   = GiftOffer.Status.SENT
            gift.sent_at  = timezone.now()
            gift.expires_at = gift.sent_at + timedelta(days=gift.valid_days)
            gift.save()
            logger.info("✅ Offre cadeau #%d créée et email envoyé à %s", gift.id, user.email)
        else:
            logger.warning("⚠️ Offre cadeau #%d créée mais email non envoyé", gift.id)

        return Response({
            "id":          gift.id,
            "user_email":  user.email,
            "gift_type":   gift.gift_type,
            "gift_value":  str(gift.gift_value),
            "status":      gift.status,
            "sent_at":     gift.sent_at.isoformat() if gift.sent_at else None,
            "expires_at":  gift.expires_at.isoformat() if gift.expires_at else None,
            "email_sent":  sent,
            "token":       gift.token,
        }, status=201)


class GiftOfferDetailView(APIView):
    """
    GET /api/analytics/gifts/<token>/
    
    Permet au client de voir son offre (via le lien email).
    Public : accessible sans authentification (via token unique).
    """
    permission_classes = [AllowAny]

    def get(self, request, token):
        if not GiftOffer:
            return Response({"error": "Module GiftOffer non disponible"}, status=501)

        try:
            gift = GiftOffer.objects.select_related("user").get(token=token)
        except GiftOffer.DoesNotExist:
            return Response({"error": "Offre introuvable ou lien invalide"}, status=404)

        # Vérifier expiration
        if gift.is_expired() and gift.status == GiftOffer.Status.SENT:
            gift.status = GiftOffer.Status.EXPIRED
            gift.save(update_fields=["status"])

        gift_type_labels = {
            "discount": f"Réduction de {gift.gift_value}%",
            "product":  "Article offert",
            "shipping": "Livraison gratuite",
            "points":   f"{gift.gift_value:.0f} points fidélité",
            "voucher":  f"Bon d'achat de {gift.gift_value} DT",
        }

        return Response({
            "token":        token,
            "first_name":   gift.user.first_name,
            "gift_type":    gift.gift_type,
            "gift_label":   gift_type_labels.get(gift.gift_type, "Cadeau exclusif"),
            "gift_value":   str(gift.gift_value),
            "gift_details": gift.gift_details,
            "status":       gift.status,
            "expires_at":   gift.expires_at.isoformat() if gift.expires_at else None,
            "is_expired":   gift.is_expired(),
            "can_respond":  gift.status == GiftOffer.Status.SENT and not gift.is_expired(),
        })


class GiftOfferRespondView(APIView):
    """
    POST /api/analytics/gifts/<token>/respond/
    
    Le client accepte ou refuse son offre.
    
    Body : { "action": "accept" | "decline" }
    
    Public : accessible sans auth (via token sécurisé).
    """
    permission_classes = [AllowAny]

    def post(self, request, token):
        if not GiftOffer:
            return Response({"error": "Module GiftOffer non disponible"}, status=501)

        try:
            gift = GiftOffer.objects.select_related("user").get(token=token)
        except GiftOffer.DoesNotExist:
            return Response({"error": "Offre introuvable"}, status=404)

        if gift.is_expired():
            gift.status = GiftOffer.Status.EXPIRED
            gift.save(update_fields=["status"])
            return Response({"error": "Cette offre a expiré"}, status=410)

        if gift.status not in [GiftOffer.Status.SENT]:
            return Response({
                "error": f"Offre déjà traitée (statut : {gift.status})"
            }, status=409)

        action = request.data.get("action")
        if action not in ["accept", "decline"]:
            return Response({"error": "action doit être 'accept' ou 'decline'"}, status=400)

        gift.status       = GiftOffer.Status.ACCEPTED if action == "accept" else GiftOffer.Status.DECLINED
        gift.responded_at = timezone.now()
        gift.save(update_fields=["status", "responded_at"])

        msg = (
            "🎉 Félicitations ! Votre offre a été acceptée. Elle sera appliquée à votre prochain achat."
            if action == "accept" else
            "Votre réponse a bien été enregistrée. Merci de votre fidélité !"
        )

        logger.info("🎁 Offre #%d %s par %s",
                    gift.id,
                    "ACCEPTÉE" if action == "accept" else "REFUSÉE",
                    gift.user.email)

        return Response({
            "status":  gift.status,
            "message": msg,
            "gift_type": gift.gift_type,
            "gift_value": str(gift.gift_value),
        })


class ResegmentView(APIView):
    """
    POST /api/analytics/resegment/
    
    Déclenche une resegmentation complète via FastAPI.
    Admin uniquement.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        result = _call_ml("/ml/resegment")
        if not result:
            return Response({"error": "ML service indisponible"}, status=503)
        return Response(result)


class GiftOffersListView(APIView):
    """
    GET /api/analytics/gifts/
    
    Liste de toutes les offres cadeaux (admin).
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        if not GiftOffer:
            return Response({"gifts": []})

        status_filter = request.query_params.get("status")
        qs = GiftOffer.objects.select_related("user").order_by("-created_at")
        if status_filter:
            qs = qs.filter(status=status_filter)

        gifts = []
        for g in qs[:200]:
            gifts.append({
                "id":          g.id,
                "user_email":  g.user.email,
                "user_name":   g.user.get_full_name(),
                "segment":     g.segment,
                "gift_type":   g.gift_type,
                "gift_value":  str(g.gift_value),
                "gift_details":g.gift_details,
                "status":      g.status,
                "valid_days":  g.valid_days,
                "sent_at":     g.sent_at.isoformat() if g.sent_at else None,
                "expires_at":  g.expires_at.isoformat() if g.expires_at else None,
                "responded_at":g.responded_at.isoformat() if g.responded_at else None,
                "is_expired":  g.is_expired(),
            })

        return Response({"gifts": gifts, "total": len(gifts)})
    

class SiteStatsView(APIView):
    """
    GET /api/analytics/site-stats/

    KPIs globaux du site calculés côté serveur (SQL agrégé).
    Retourne :
    - total_orders, total_revenue, pending_orders, delivered_orders
    - total_customers, total_products, total_categories
    - monthly_revenue (12 mois de l'année sélectionnée)
    - annual_revenue (toutes années)
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from django.db.models.functions import ExtractYear
        from apps.products.models import Product, Category
        import datetime

        year = int(request.query_params.get('year', datetime.date.today().year))

        # ── Agrégats globaux ─────────────────────────────────────────────
        order_stats = Order.objects.aggregate(
            total_orders   = Count('id'),
            total_revenue  = Sum('total_amount', filter=models.Q(status='DELIVERED')),
            pending_orders = Count('id', filter=models.Q(status='PENDING')),
            delivered_orders = Count('id', filter=models.Q(status='DELIVERED')),
            cancelled_orders = Count('id', filter=models.Q(status='CANCELLED')),
        )

        total_customers = User.objects.filter(role='CLIENT', is_active=True).count()
        total_products  = Product.objects.filter(status='ACTIVE').count()
        total_categories = Category.objects.filter(is_active=True).count()

        # ── Revenus mensuels (année sélectionnée) ───────────────────────
        from django.db.models.functions import ExtractMonth
        monthly_qs = (
            Order.objects
            .filter(status='DELIVERED', created_at__year=year)
            .annotate(month=ExtractMonth('created_at'))
            .values('month')
            .annotate(revenue=Sum('total_amount'), orders=Count('id'))
            .order_by('month')
        )
        MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
        monthly_map = {r['month']: r for r in monthly_qs}
        monthly_revenue = [
            {
                'month'  : MONTHS_FR[i],
                'revenue': float(monthly_map.get(i+1, {}).get('revenue', 0) or 0),
                'orders' : monthly_map.get(i+1, {}).get('orders', 0),
            }
            for i in range(12)
        ]

        # ── Revenus annuels ──────────────────────────────────────────────
        from django.db.models.functions import ExtractYear
        annual_qs = (
            Order.objects
            .filter(status='DELIVERED')
            .annotate(year=ExtractYear('created_at'))
            .values('year')
            .annotate(revenue=Sum('total_amount'), orders=Count('id'))
            .order_by('year')
        )
        annual_revenue = [
            {
                'year'   : r['year'],
                'revenue': float(r['revenue'] or 0),
                'orders' : r['orders'],
            }
            for r in annual_qs
        ]

        return Response({
            'total_orders'    : order_stats['total_orders'] or 0,
            'total_revenue'   : float(order_stats['total_revenue'] or 0),
            'pending_orders'  : order_stats['pending_orders'] or 0,
            'delivered_orders': order_stats['delivered_orders'] or 0,
            'cancelled_orders': order_stats['cancelled_orders'] or 0,
            'total_customers' : total_customers,
            'total_products'  : total_products,
            'total_categories': total_categories,
            'selected_year'   : year,
            'monthly_revenue' : monthly_revenue,
            'annual_revenue'  : annual_revenue,
        })
  
