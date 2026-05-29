"""
=============================================================
 apps/products/models.py
=============================================================
"""

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.users.models import User


class Category(models.Model):
    """Catégorie de produits (hiérarchique : parent/enfant)"""
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='categories/', blank=True)
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='children'
    )
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Catégorie"
        verbose_name_plural = "Catégories"
        db_table = "categories"
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class Product(models.Model):
    """
    Produit e-commerce.

    Champs ML-spécifiques :
    - view_count       : compteur de vues (comportemental)
    - purchase_count   : nb d'achats (popularité)
    Ces champs alimentent le module de recommandation.
    """

    class Status(models.TextChoices):
        ACTIVE   = 'ACTIVE',   'Actif'
        INACTIVE = 'INACTIVE', 'Inactif'
        DRAFT    = 'DRAFT',    'Brouillon'

    # ── Infos de base ────────────────────────────────────────
    name = models.CharField(max_length=500)
    slug = models.SlugField(max_length=500, unique=True)
    description = models.TextField(blank=True)
    sku = models.CharField(max_length=100, unique=True, verbose_name="Code SKU")

    # ── Catégorie ─────────────────────────────────────────────
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT,
        related_name='products', verbose_name="Catégorie"
    )

    # ── Prix ─────────────────────────────────────────────────
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Prix TTC")
    original_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        verbose_name="Prix barré (avant réduction)"
    )

    # ── Stock ─────────────────────────────────────────────────
    stock_quantity = models.PositiveIntegerField(default=0, verbose_name="Quantité en stock")

    # ── Médias ───────────────────────────────────────────────
    image = models.ImageField(upload_to='products/', blank=True, verbose_name="Image principale")

    # ── Métriques comportementales (alimentent le ML) ────────
    view_count = models.PositiveIntegerField(default=0)
    purchase_count = models.PositiveIntegerField(default=0)

    # ── Statut & dates ────────────────────────────────────────
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    is_featured = models.BooleanField(default=False, verbose_name="Mis en avant")
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Produit"
        verbose_name_plural = "Produits"
        db_table = "products"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['category', 'status']),
            models.Index(fields=['slug']),
            # Index sur reviews pour accélérer les COUNT/AVG
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return self.name

    @property
    def discount_percentage(self):
        """Calcule le % de réduction si un prix barré existe"""
        if self.original_price and self.original_price > self.price:
            discount = (self.original_price - self.price) / self.original_price * 100
            return round(discount)
        return 0

    @property
    def is_in_stock(self):
        return self.stock_quantity > 0

    @property
    def average_rating(self):
        """
        Utilise l'annotation _avg_rating injectée par le queryset (.annotate())
        → 0 requête supplémentaire dans les listes.
        Fallback: agrégat direct si appelé hors contexte annoté.
        """
        # L'annotation est injectée par ProductViewSet.get_queryset()
        annotated = getattr(self, '_avg_rating', None)
        if annotated is not None:
            return round(float(annotated), 1)
        result = self.reviews.aggregate(models.Avg('rating'))['rating__avg']
        return round(float(result), 1) if result else 0

    @property
    def review_count(self):
        """
        Utilise l'annotation _review_count injectée par le queryset.
        → 0 requête supplémentaire dans les listes.
        """
        annotated = getattr(self, '_review_count', None)
        if annotated is not None:
            return int(annotated)
        return self.reviews.count()


class ProductImage(models.Model):
    """Galerie d'images pour un produit"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/gallery/')
    alt_text = models.CharField(max_length=200, blank=True)
    is_primary = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        db_table = "product_images"


class Review(models.Model):
    """Avis et notes clients"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        verbose_name="Note (1-5)"
    )
    title = models.CharField(max_length=200, blank=True)
    comment = models.TextField()
    is_verified_purchase = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Avis"
        db_table = "product_reviews"
        unique_together = ['product', 'user']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.get_full_name()} → {self.product.name} ('★' * {self.rating})"