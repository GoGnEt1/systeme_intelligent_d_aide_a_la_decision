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
        annotated = getattr(obj, '_product_count', None)
        if annotated is not None:
            return int(annotated)
        return Product.objects.filter(
            category_id=obj.id, status='ACTIVE'
        ).count()


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
    Sérialiseur admin — tous les champs + écriture.
    """
    category_name  = serializers.CharField(source='category.name', read_only=True)
    images         = ProductImageSerializer(many=True, read_only=True)
    # FIX : reviews maintenant inclus pour les admins aussi
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
            'image', 'images', 'category', 'category_name',
            'is_in_stock', 'stock_quantity', 'is_featured', 'status',
            'average_rating', 'review_count', 'reviews',
            'view_count', 'purchase_count',
            'created_at', 'updated_at',
        ]

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Le nom du produit est requis.")
        return value.strip()

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le prix doit être positif.")
        return value

    def validate_sku(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Le SKU est requis.")
        return value.strip().upper()

    def create(self, validated_data):
        if not validated_data.get('slug'):
            base = slugify(validated_data.get('name', ''))
            validated_data['slug'] = f"{base}-{uuid.uuid4().hex[:6]}"
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'name' in validated_data and not validated_data.get('slug'):
            validated_data['slug'] = instance.slug
        return super().update(instance, validated_data)