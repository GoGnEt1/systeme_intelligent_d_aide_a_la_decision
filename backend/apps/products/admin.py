from django.contrib import admin

# Register your models here.
"""
=============================================================
 apps/products/admin.py
 Enregistrement dans l'interface d'administration Django
 Accessible sur : http://localhost:8000/admin/
=============================================================
"""
from django.contrib import admin
from .models import Category, Product, ProductImage, Review


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ReviewInline(admin.TabularInline):
    model = Review
    extra = 0
    readonly_fields = ['user', 'rating', 'comment', 'created_at']


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display  = ['name', 'slug', 'parent', 'is_active', 'order']
    list_filter   = ['is_active', 'parent']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display   = ['name', 'sku', 'category', 'price', 'stock_quantity',
                      'status', 'is_featured', 'view_count', 'purchase_count']
    list_filter    = ['status', 'is_featured', 'category']
    search_fields  = ['name', 'sku', 'description']
    prepopulated_fields = {'slug': ('name',)}
    inlines        = [ProductImageInline, ReviewInline]
    list_editable  = ['price', 'stock_quantity', 'status', 'is_featured']
    readonly_fields = ['view_count', 'purchase_count', 'created_at', 'updated_at']

    fieldsets = (
        ('Informations de base', {
            'fields': ('name', 'slug', 'sku', 'description', 'category', 'status', 'is_featured')
        }),
        ('Prix & Stock', {
            'fields': ('price', 'original_price', 'stock_quantity')
        }),
        ('Médias', {
            'fields': ('image',)
        }),
        ('Métriques ML (lecture seule)', {
            'fields': ('view_count', 'purchase_count'),
            'classes': ('collapse',)
        }),
    )
