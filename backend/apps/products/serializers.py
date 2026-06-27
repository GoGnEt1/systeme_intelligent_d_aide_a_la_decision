"""
=============================================================
 apps/products/serializers.py — CORRIGÉ v2

   - CategorySerializer.get_product_count : utilise l'annotation
     _product_count injectée par le queryset → 0 requête extra
   - average_rating / review_count : ReadOnlyField → lisent les
     @property du modèle qui eux-mêmes lisent les annotations
=============================================================
"""
from rest_framework import serializers
from .models import Category, Product, ProductImage, Review
from django.utils.text import slugify
import uuid


class CategorySerializer(serializers.ModelSerializer):
    children      = serializers.SerializerMethodField()
    parent_name   = serializers.CharField(source='parent.name', read_only=True, default=None)
    parent_slug   = serializers.CharField(source='parent.slug', read_only=True, default=None)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model  = Category
        fields = [
            'id', 'name', 'slug', 'description', 'image',
            'parent', 'parent_name', 'parent_slug',
            'children', 'is_active', 'order', 'product_count'
        ]

    def get_children(self, obj):
        qs = obj.children.filter(is_active=True).order_by('order', 'name')
        return CategorySerializer(qs, many=True, context=self.context).data

    def get_product_count(self, obj):
        if obj.parent_id is None:
            return Product.objects.filter(
                category__parent=obj,
                status='ACTIVE'
            ).count()

        return Product.objects.filter(
            category=obj,
            status='ACTIVE'
        ).count()
    # def get_product_count(self, obj):
    #     annotated = getattr(obj, '_product_count', None)
    #     if annotated is not None:
    #         return int(annotated)
    #     return Product.objects.filter(
    #         category_id=obj.id, status='ACTIVE'
    #     ).count()


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProductImage
        fields = ['id', 'image', 'alt_text', 'is_primary', 'order']


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model  = Review
        fields = ['id', 'user_name', 'rating', 'title', 'comment',
                  'is_verified_purchase', 'created_at']
        read_only_fields = ['user_name', 'is_verified_purchase', 'created_at']


class ProductListSerializer(serializers.ModelSerializer):
    """Sérialiseur léger pour les listes"""
    category_name       = serializers.CharField(source='category.name', read_only=True)
    category_slug       = serializers.CharField(source='category.slug', read_only=True)
    discount_percentage = serializers.ReadOnlyField()
    is_in_stock         = serializers.ReadOnlyField()
    average_rating      = serializers.ReadOnlyField()
    review_count        = serializers.ReadOnlyField()
    images              = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model  = Product
        fields = [
            'id', 'name', 'slug', 'price', 'original_price',
            'discount_percentage', 'image', 'category', 'category_name', 'category_slug',
            'is_in_stock', 'stock_quantity', 'is_featured', 'status',
            'average_rating', 'review_count', 'view_count', 'sku', 'images'
        ]


class ProductDetailSerializer(serializers.ModelSerializer):
    """Sérialiseur complet pour la page détail produit (tous utilisateurs)"""
    category       = CategorySerializer(read_only=True)
    images         = ProductImageSerializer(many=True, read_only=True)
    reviews        = ReviewSerializer(many=True, read_only=True)
    average_rating = serializers.ReadOnlyField()
    review_count   = serializers.ReadOnlyField()
    discount_percentage = serializers.ReadOnlyField()
    is_in_stock    = serializers.ReadOnlyField()

    class Meta:
        model  = Product
        fields = [
            'id', 'name', 'slug', 'description', 'sku',
            'price', 'original_price', 'discount_percentage',
            'image', 'images', 'category',
            'is_in_stock', 'stock_quantity', 'is_featured', 'status',
            'average_rating', 'review_count', 'reviews',
            'view_count', 'purchase_count',
            'created_at', 'updated_at',
        ]


class AdminProductSerializer(serializers.ModelSerializer):
    """
    Sérialiseur admin : tous les champs + écriture.
 
    Points clés :
    ─────────────
    • slug       → TOUJOURS read_only : auto-généré depuis `name` dans create/update.
                   Jamais envoyé par le frontend, jamais validé en entrée.
    • sku        → writable, validé unique (hors instance courante).
    • category   → PrimaryKeyRelatedField (int envoyé par le frontend).
    • views/purchases → read_only (compteurs ML).
    """
    # ── Champs calculés / lecture seule ──────────────────────────────────────
    category_name       = serializers.CharField(source='category.name', read_only=True)
    category_slug       = serializers.CharField(source='category.slug', read_only=True)
    images              = ProductImageSerializer(many=True, read_only=True)
    reviews             = ReviewSerializer(many=True, read_only=True)
    average_rating      = serializers.ReadOnlyField()
    review_count        = serializers.ReadOnlyField()
    discount_percentage = serializers.ReadOnlyField()
    is_in_stock         = serializers.ReadOnlyField()
 
    class Meta:
        model  = Product
        fields = [
            'id', 'name', 'slug', 'sku', 'description',
            'price', 'original_price', 'discount_percentage',
            'stock_quantity', 'image', 'images',
            'category', 'category_name', 'category_slug',
            'is_in_stock', 'is_featured', 'status',
            'average_rating', 'review_count', 'reviews',
            'view_count', 'purchase_count', 'created_at', 'updated_at',
        ]
        # ── slug est read_only : DRF ne le valide JAMAIS en entrée ──────────
        # Sans cela, ModelSerializer l'auto-génère comme CharField(required=True)
        # à cause de unique=True sur le modèle → Bad Request 400 à la création.
        read_only_fields = [
            'slug', 'view_count', 'purchase_count',
            'created_at', 'updated_at',
        ]
        extra_kwargs = {
            # original_price optionnel
            'original_price': {'required': False, 'allow_null': True},
            # image optionnelle
            'image': {'required': False, 'allow_null': True},
        }
 
    # ── Validation SKU unique ────────────────────────────────────────────────
    def validate_sku(self, value):
        """SKU unique — exclut l'instance courante lors d'une mise à jour."""
        value = value.strip().upper() if value else value
        if not value:
            raise serializers.ValidationError("Le SKU est requis.")
        qs = Product.objects.filter(sku=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f"Le SKU « {value} » est déjà utilisé par un autre produit."
            )
        return value
 
    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Le nom du produit est requis.")
        return value.strip()
 
    def validate_price(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Le prix doit être strictement positif.")
        return value
 
    def validate(self, attrs):
        """Vérifie original_price > price si fourni."""
        price    = attrs.get('price', getattr(self.instance, 'price', None))
        op       = attrs.get('original_price', getattr(self.instance, 'original_price', None))
        if price and op and op <= price:
            raise serializers.ValidationError({
                'original_price': "Le prix barré doit être supérieur au prix de vente."
            })
        return attrs
 
    # ── Helpers slug ─────────────────────────────────────────────────────────
    @staticmethod
    def _unique_slug(name: str, exclude_pk=None) -> str:
        """Génère un slug unique à partir du nom."""
        base  = slugify(name) or f"produit-{uuid.uuid4().hex[:6]}"
        slug  = base
        n     = 1
        while True:
            qs = Product.objects.filter(slug=slug)
            if exclude_pk:
                qs = qs.exclude(pk=exclude_pk)
            if not qs.exists():
                return slug
            slug = f"{base}-{n}"
            n += 1
 
    # ── Création ─────────────────────────────────────────────────────────────
    def create(self, validated_data):
        """Auto-génère le slug à la création (jamais envoyé par le frontend)."""
        validated_data['slug'] = self._unique_slug(validated_data.get('name', ''))
        return super().create(validated_data)
 
    # ── Mise à jour ──────────────────────────────────────────────────────────
    def update(self, instance, validated_data):
        """Re-génère le slug si le nom change significativement."""
        new_name = validated_data.get('name')
        if new_name and new_name != instance.name:
            # Régénérer uniquement si le slugify produit un résultat différent
            new_slug = slugify(new_name)
            if new_slug != instance.slug.rsplit('-', 1)[0]:
                validated_data['slug'] = self._unique_slug(new_name, exclude_pk=instance.pk)
        return super().update(instance, validated_data)
