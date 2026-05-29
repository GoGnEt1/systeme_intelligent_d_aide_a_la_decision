"""
=============================================================
 apps/products/views.py
=============================================================
"""
from django.db.models import Avg, Count, Q
from django.db.models.deletion import ProtectedError
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import rest_framework as rf_filters
from .models import Category, Product, Review, ProductImage
from .serializers import (
    CategorySerializer, ProductListSerializer,
    ProductDetailSerializer, ReviewSerializer,
    AdminProductSerializer, ProductImageSerializer,
)
from apps.orders.models import OrderItem

from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
import os
from rest_framework.views import APIView



class IsAdminOrReadOnly(permissions.BasePermission):
    """Lecture pour tous, écriture pour admins uniquement"""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and getattr(request.user, 'is_admin', False)


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, 'is_admin', False)


class ProductFilter(rf_filters.FilterSet):
    """Filtres avancés : prix min/max, catégorie, stock, promo"""
    price_min     = rf_filters.NumberFilter(field_name='price', lookup_expr='gte')
    price_max     = rf_filters.NumberFilter(field_name='price', lookup_expr='lte')
    category      = rf_filters.CharFilter(method='filter_by_category')
    category_name = rf_filters.CharFilter(field_name='category__name', lookup_expr='iexact')
    in_stock      = rf_filters.BooleanFilter(field_name='stock_quantity', method='filter_in_stock')
    on_sale       = rf_filters.BooleanFilter(method='filter_on_sale')

    class Meta:
        model  = Product
        fields = ['category', 'is_featured', 'status']

    def filter_by_category(self, queryset, name, value):
        try:
            cat = Category.objects.get(slug=value, is_active=True)
            if cat.parent is None:
                child_ids = list(cat.children.filter(is_active=True).values_list('id', flat=True))
                all_ids = [cat.id] + child_ids
                return queryset.filter(category_id__in=all_ids)
            else:
                return queryset.filter(category=cat)
        except Category.DoesNotExist:
            return queryset.filter(category__slug=value)

    def filter_in_stock(self, queryset, name, value):
        return queryset.filter(stock_quantity__gt=0) if value else queryset

    def filter_on_sale(self, queryset, name, value):
        return queryset.filter(original_price__isnull=False) if value else queryset


# ─────────────────────────────────────────────────────────────
#  CATÉGORIES
# ─────────────────────────────────────────────────────────────

class CategoryViewSet(viewsets.ModelViewSet):
    """
    GET  /api/products/categories/        → liste des catégories racines avec enfants
    GET  /api/products/categories/{slug}/ → détail + sous-catégories
    POST/PUT/PATCH/DELETE                 → admin uniquement
    """
    serializer_class   = CategorySerializer
    lookup_field       = 'slug'
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Category.objects.all() \
            .select_related('parent') \
            .prefetch_related('children', 'children__children') \
            .annotate(
                # Nombre de produits ACTIVE par catégorie — 0 requête extra
                _product_count=Count(
                    'products',
                    filter=Q(products__status='ACTIVE'),
                    distinct=True
                )
            )

        parent_param = self.request.query_params.get('parent', None)
        if parent_param in ('null', 'none'):
            qs = qs.filter(parent=None)
        elif parent_param is not None:
            try:
                qs = qs.filter(parent_id=int(parent_param))
            except ValueError:
                pass

        if not (self.request.user.is_authenticated and (
            self.request.user.is_staff or
            getattr(self.request.user, 'is_admin', False)
        )):
            qs = qs.filter(is_active=True)
            if parent_param is None:
                qs = qs.filter(parent=None)

        return qs.order_by('order', 'name')

    def perform_destroy(self, instance):
        """Soft-delete si des produits sont liés (FK PROTECT)."""
        try:
            instance.delete()
        except ProtectedError:
            instance.is_active = False
            instance.save(update_fields=['is_active'])
            instance.children.all().update(is_active=False)


# ─────────────────────────────────────────────────────────────
#  PRODUITS — VUE PUBLIQUE
# ─────────────────────────────────────────────────────────────

def _product_qs_with_annotations(base_qs, *, with_reviews=False):
    """
    Centralise les annotations de performance sur un queryset produit.
    Injecte _avg_rating et _review_count → utilisés par les @property
    du modèle sans requête supplémentaire.
    with_reviews=True : prefetch reviews (page détail seulement).
    """
    qs = base_qs \
        .select_related('category') \
        .prefetch_related('images') \
        .annotate(
            _avg_rating=Avg('reviews__rating'),
            _review_count=Count('reviews', distinct=True),
        )
    if with_reviews:
        qs = qs.prefetch_related('reviews__user')
    return qs


class ProductViewSet(viewsets.ModelViewSet):
    """
    CRUD complet pour les produits.
    - Lecture publique : seuls les produits ACTIVE
    - Écriture : admin uniquement
    """
    permission_classes = [IsAdminOrReadOnly]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class    = ProductFilter
    search_fields      = ['name', 'description', 'sku', 'category__name']
    ordering_fields    = ['price', 'created_at', 'view_count', 'purchase_count', 'name']
    ordering           = ['-created_at']
    lookup_field       = 'slug'

    def get_queryset(self):
        is_admin = self.request.user.is_authenticated and getattr(self.request.user, 'is_admin', False)
        base = Product.objects.all() if is_admin else Product.objects.filter(status=Product.Status.ACTIVE)
        with_rev = self.action == 'retrieve'
        return _product_qs_with_annotations(base, with_reviews=with_rev)

    def get_serializer_class(self):
        # Admins : serialiseur complet (tous statuts + champs éditables)
        if self.request.user.is_authenticated and getattr(self.request.user, 'is_admin', False):
            return AdminProductSerializer
        # Clients / visiteurs : liste légère, détail complet (avec reviews)
        return ProductListSerializer if self.action == 'list' else ProductDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        """Incrémenter le compteur de vues"""
        instance = self.get_object()
        Product.objects.filter(pk=instance.pk).update(view_count=instance.view_count + 1)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        """Soft-delete si OrderItem liés (FK PROTECT), sinon suppression réelle."""
        if OrderItem.objects.filter(product=instance).exists():
            instance.status = Product.Status.INACTIVE
            instance.save(update_fields=['status'])
        else:
            try:
                instance.delete()
            except ProtectedError:
                raise ValidationError(
                    "Ce produit est référencé et ne peut pas être supprimé."
                )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def review(self, request, slug=None):
        """POST /api/products/{slug}/review/ → soumettre ou mettre à jour un avis"""
        product = self.get_object()
        existing = Review.objects.filter(product=product, user=request.user).first()

        new_rating = request.data.get('rating')
        try:
            new_rating = int(new_rating)
        except (TypeError, ValueError):
            new_rating = None

        if existing:
            if new_rating is None or new_rating <= existing.rating:
                return Response(
                    {
                        'error': 'already_rated',
                        'message': f'Vous avez déjà noté ce produit ({existing.rating}/5). '
                                   f'Vous pouvez mettre à jour uniquement avec une note supérieure.',
                        'existing_rating': existing.rating,
                    },
                    status=status.HTTP_409_CONFLICT
                )
            serializer = ReviewSerializer(existing, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            product.refresh_from_db()
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = ReviewSerializer(data=request.data)
        is_verified = OrderItem.objects.filter(
            order__user=request.user,
            product=product,
            order__status='DELIVERED'
        ).exists()
        serializer.is_valid(raise_exception=True)
        serializer.save(product=product, user=request.user, is_verified_purchase=is_verified)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """GET /api/products/featured/ → produits mis en avant"""
        qs = _product_qs_with_annotations(
            Product.objects.filter(status=Product.Status.ACTIVE, is_featured=True)
        )[:12]
        return Response(ProductListSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'], url_path='similar')
    def similar(self, request, slug=None):
        """GET /api/products/{slug}/similar/ → produits similaires (même catégorie)"""
        product = self.get_object()
        qs = _product_qs_with_annotations(
            Product.objects.filter(
                status=Product.Status.ACTIVE,
                category=product.category,
            ).exclude(pk=product.pk).order_by('-is_featured', '-purchase_count', '-view_count')
        )[:8]
        return Response(ProductListSerializer(qs, many=True).data)


# ─────────────────────────────────────────────────────────────
#  PRODUITS — VUE ADMIN (tous statuts + champs complets)
# ─────────────────────────────────────────────────────────────

class AdminProductViewSet(viewsets.ModelViewSet):
    """
    /api/admin/products/
    CRUD complet admin avec tous les statuts et champs éditables.
    """
    permission_classes = [IsAdmin]
    serializer_class   = AdminProductSerializer
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['name', 'sku', 'category__name']
    ordering_fields    = ['price', 'created_at', 'stock_quantity', 'name', 'status']
    ordering           = ['-created_at']
    lookup_field       = 'slug'

    def get_queryset(self):
        return _product_qs_with_annotations(Product.objects.all())


class AdminCategoryViewSet(viewsets.ModelViewSet):
    """
    /api/admin/categories/
    CRUD complet admin pour les catégories.
    """
    permission_classes = [IsAdmin]
    serializer_class   = CategorySerializer
    lookup_field       = 'slug'

    def get_queryset(self):
        return Category.objects.all() \
            .prefetch_related('children') \
            .annotate(
                _product_count=Count(
                    'products',
                    filter=Q(products__status='ACTIVE'),
                    distinct=True
                )
            )

class ProductImageViewSet(viewsets.ModelViewSet):
    """
    /api/admin/products/{slug}/images/
    CRUD pour la galerie d'images d'un produit
    """
    permission_classes = [IsAdmin]
    serializer_class   = ProductImageSerializer
    parser_classes     = [MultiPartParser, FormParser]

    def get_queryset(self):
        product = get_object_or_404(Product, slug=self.kwargs['product_slug'])
        return ProductImage.objects.filter(product=product).order_by('order')

    def perform_create(self, serializer):
        product = get_object_or_404(Product, slug=self.kwargs['product_slug'])
        serializer.save(product=product)


class ProductImageDirectView(APIView):
    """
    DELETE /api/products/images/{pk}/
    Suppression directe d'une image par son ID, sans slug produit.
    """
    permission_classes = [IsAdmin]

    def delete(self, request, pk):
        img = get_object_or_404(ProductImage, pk=pk)
        if img.image and hasattr(img.image, 'path'):
            try:
                if os.path.isfile(img.image.path):
                    os.remove(img.image.path)
            except Exception:
                pass
        img.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)