"""
=============================================================
 apps/orders/serializers.py  — VERSION CORRIGÉE
   - CartItemSerializer expose product_name, unit_price, product_image
     directement (compatibles avec les types TS du frontend)
   - removeCartItem renvoie le panier mis à jour
=============================================================
"""
from rest_framework import serializers
from .models import Cart, CartItem, Order, OrderItem, OrderStatusHistory
from apps.products.models import Product
from apps.payements.serializers import PaymentSerializer, CreatePaymentSerializer

class CartItemSerializer(serializers.ModelSerializer):
    """
    Sérialiseur d'un article du panier.
    On expose les champs plats attendus par le frontend TypeScript :
      product        → id du produit (number)
      product_name   → nom (string)
      product_image  → URL image (string | null)
      product_slug   → slug pour le lien (string)
      unit_price     → prix unitaire (number)
      subtotal       → sous-total calculé (number)
    """
    # Champs plats dérivés du produit associé
    product_name  = serializers.CharField(source='product.name',  read_only=True)
    # product_image = serializers.ImageField(source='product.image', read_only=True, use_url=True)
    product_slug  = serializers.SlugField(source='product.slug',  read_only=True)
    unit_price    = serializers.DecimalField(
        source='product.price', max_digits=10, decimal_places=2, read_only=True
    )
    subtotal      = serializers.SerializerMethodField()

    product_image = serializers.SerializerMethodField()

    def get_product_image(self, obj):
        """
        Retourner une URL absolue vers l'image du produit.
        """
        request = self.context.get('request')

        # Image principale
        if obj.product.image:
            if request:
                return request.build_absolute_uri(obj.product.image.url)
            return obj.product.image.url # fallback URL relative
        
        # première image de la galerie
        first = obj.product.images.first()
        if first and first.image:
            if request:
                return request.build_absolute_uri(first.image.url)
            return first.image.url
        
        return None
    
    # product reste l'ID (lecture) + product_id en écriture
    product = serializers.PrimaryKeyRelatedField(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.filter(status='ACTIVE'),
        source='product',
        write_only=True
    )

    class Meta:
        model  = CartItem
        fields = [
            'id', 'product', 'product_id',
            'product_name', 'product_image', 'product_slug',
            'unit_price', 'quantity', 'subtotal', 'added_at'
        ]

    def get_subtotal(self, obj):
        return float(obj.get_subtotal())

class CartSerializer(serializers.ModelSerializer):
    items      = CartItemSerializer(many=True, read_only=True)
    total      = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    shipping_cost = serializers.SerializerMethodField()
    tva_timbre    = serializers.SerializerMethodField()
    grand_total   = serializers.SerializerMethodField()

    class Meta:
        model  = Cart
        fields = ['id', 'items', 'total', 'item_count', 'shipping_cost', 'tva_timbre', 'grand_total', 'updated_at']

    def get_total(self, obj):
        return float(obj.get_total())

    def get_item_count(self, obj):
        return obj.get_item_count()
    
    def get_shipping_cost(self, obj):
        return float(obj.get_shipping_cost())
    
    def get_tva_timbre(self, obj):
        return 1.00 or float(obj.get_tva_timbre())
    
    def get_grand_total(self, obj):
        return float(obj.get_grand_total())

class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()
    old_status_display = serializers.SerializerMethodField()
    new_status_display = serializers.SerializerMethodField()

    STATUS_LABELS = {
        'PENDING': 'En attente', 'CONFIRMED': 'Confirmée',
        'PROCESSING': 'En préparation', 'SHIPPED': 'Expédiée',
        'DELIVERED': 'Livrée', 'CANCELLED': 'Annulée', 'REFUNDED': 'Remboursée',
    }

    def get_changed_by_name(self, obj):
        return obj.changed_by.get_full_name() if obj.changed_by else 'Système'

    def get_old_status_display(self, obj):
        return self.STATUS_LABELS.get(obj.old_status, obj.old_status)

    def get_new_status_display(self, obj):
        return self.STATUS_LABELS.get(obj.new_status, obj.new_status)

    class Meta:
        model  = OrderStatusHistory
        fields = ['id', 'old_status', 'old_status_display', 'new_status', 'new_status_display',
                  'changed_by_name', 'changed_at', 'note']


class OrderItemSerializer(serializers.ModelSerializer):
    subtotal = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    product_slug  = serializers.SlugField(source='product.slug',  read_only=True)

    class Meta:
        model  = OrderItem
        fields = ['id', 'product', 'product_name', 'unit_price', 'quantity', 'subtotal', 'product_image', 'product_slug']

    def get_subtotal(self, obj):
        return float(obj.get_subtotal())
    
    def get_product_image(self, obj):
        """
        Retourner une URL absolue vers l'image du produit.
        """
        request = self.context.get('request')

        try:
            product = obj.product
        except Exception:
            return None  # produit supprimé

        if product.image:
            return request.build_absolute_uri(product.image.url) if request else product.image.url

        first = product.images.first()
        if first and first.image:
            return request.build_absolute_uri(first.image.url) if request else first.image.url

        return None


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    can_cancel     = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment        = PaymentSerializer(read_only=True)

    def get_can_cancel(self, obj):
        request = self.context.get('request')
        if request and request.user == obj.user:
            return obj.can_client_cancel()
        return False
    
    class Meta:
        model  = Order
        fields = [
            'id', 'order_number', 'status', 'status_display', 'can_cancel',
            'items', 'status_history', 'payment',
            'subtotal', 'shipping_cost', 'tva_timbre', 'discount_amount', 'total_amount',
            'shipping_full_name', 'shipping_address_line', 'shipping_city',
            'shipping_postal_code', 'shipping_phone', 'shipping_country',
            'notes', 'created_at', 'delivered_at',
            'delivery_date', 'delivery_attempts', 'no_more_delivery',
        ]
        
        read_only_fields = ['order_number', 'status', 'subtotal', 'shipping_cost',
            'tva_timbre', 'total_amount', 'created_at',
            'delivery_attempts', 'no_more_delivery'
        ]


class CreateOrderSerializer(serializers.Serializer):
    """Sérialiseur pour créer une commande depuis le panier"""
    shipping_address_id = serializers.IntegerField(required=False, allow_null=True)
    notes               = serializers.CharField(required=False, allow_blank=True)
    
    # Infos livraison si pas d'adresse enregistrée
    shipping_info = serializers.DictField(required=False, default=dict)

    payment_method = serializers.ChoiceField(
        choices=[('COD', ''), ('MOBILE', ''), ('CARD', '')],
        default='COD'
    )
    idinar_number = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        # Déléguer la validation paiement au serializer dédié
        payment_data = {
            'payment_method': data.get('payment_method', 'COD'),
            'idinar_number':  data.get('idinar_number', ''),
        }
        payment_serializer = CreatePaymentSerializer(data=payment_data)
        payment_serializer.is_valid(raise_exception=True)
        return data
