"""
=============================================================
 apps/orders/views.py
   - CartItemDetailView.delete renvoie le panier mis à jour
     (frontend peut recalculer total/count sans re-fetch)
   - CartItemView : meilleure gestion des erreurs (product_id manquant)
   - OrderListCreateView : admin voit tous les statuts
=============================================================
"""
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from django.db import transaction
from django.shortcuts import get_object_or_404
import logging
import traceback
logger = logging.getLogger(__name__)
from django.core.exceptions import ValidationError
from rest_framework import filters

# from .models import Cart, CartItem, Order, OrderItem
from .models import Cart, CartItem, Order, OrderItem, OrderStatusHistory, SHIPPING_COST, SHIPPING_THRESHOLD, TVA_TIMBRE
from apps.products.models import Product
from apps.payements.models import Payment
from apps.users.models import User, Address
from .serializers import (
    CartSerializer, CartItemSerializer, OrderSerializer,
    CreateOrderSerializer, OrderStatusHistorySerializer
)
from django.utils import timezone
from smartshop.utils.email_utils import send_html_email
from decimal import Decimal
from django.conf import settings

# Helper pour ne pas répéter context={'request': request} partout
def cart_response(cart, request, http_status=status.HTTP_200_OK):
    """Sérialise le panier avec le contexte request (pour les URLs absolues)."""
    return Response(
        CartSerializer(cart, context={'request': request}).data,
        status=http_status
    )

def send_admin_notification(order, template: str, subject: str, request=None):
    """
    Envoie un email à l'admin (EMAIL_HOST_USER) pour chaque nouvelle commande.
    """
    admin_email = settings.EMAIL_HOST_USER
    if not admin_email:
        return
    base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173/')
    
    # select_related pour éviter N+1 et surtout DoesNotExist sur payment
    from apps.orders.models import Order as _Order
    try:
        order = _Order.objects.select_related('user', 'payment').get(pk=order.pk)
    except Exception:
        pass  # on utilise l'objet tel quel si la requête échoue

    send_html_email(
        subject=subject,
        template=template,
        context={
            'order':    order,
            'client':     order.user,
            'items':    order.items.select_related('product').all(),
            'base_url': base_url,
            'year':     timezone.now().year,
        },
        recipient_list=admin_email,
    )
    
def send_order_email(order: Order, template: str, subject: str, request=None):
    """Helper : envoie un email de suivi de commande au client"""
    # Recharger l'objet avec toutes les relations pour éviter DoesNotExist sur
    # order.payment (OneToOne) lors du rendu du template
    try:
        order = Order.objects.select_related('user', 'payment').get(pk=order.pk)
    except Exception:
        pass  # on utilise l'objet passé en paramètre si la requête échoue

    user = order.user
    to_mail = user.email
    if not to_mail or '@' not in str(to_mail):
        return  # pas d'email → pas d'envoi

    base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173/')

    send_html_email(
        subject=subject,
        template=template,
        context={
            'user': user,
            'order': order,
            'items':    order.items.select_related('product').all(),
            'base_url': base_url,
            'year': timezone.now().year,
        },
        recipient_list=to_mail,
    )


# ─────────────────────────────────────────────────────────────
#  PANIER
# ─────────────────────────────────────────────────────────────

class CartView(APIView):
    """GET /api/orders/cart/ → Retourne (ou crée) le panier du client"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return cart_response(cart, request)


class CartItemView(APIView):
    """POST /api/orders/cart/items/ → Ajouter/mettre à jour un produit"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        product_id = request.data.get('product_id')
        quantity   = request.data.get('quantity', 1)

        # ── Validation des paramètres ─────────────────────────
        if not product_id:
            return Response(
                {'error': 'Le champ product_id est requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            quantity = int(quantity)
            if quantity < 1:
                raise ValueError()
        except (ValueError, TypeError):
            return Response(
                {'error': 'La quantité doit être un entier positif.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        product = get_object_or_404(Product, id=product_id, status=Product.Status.ACTIVE)

        # ── Vérifier le stock ─────────────────────────────────
        if product.stock_quantity < quantity:
            return Response(
                {'error': f'Stock insuffisant. Disponible : {product.stock_quantity}'},
                status=status.HTTP_409_CONFLICT
            )

        cart, _ = Cart.objects.get_or_create(user=request.user)
        item, created = CartItem.objects.get_or_create(cart=cart, product=product)

        if not created:
            new_qty = item.quantity + quantity
            if product.stock_quantity < new_qty:
                return Response({'error': 'Stock insuffisant.'}, status=status.HTTP_409_CONFLICT)
            item.quantity = new_qty
        else:
            item.quantity = quantity
        item.save()

        return cart_response(cart, request, status.HTTP_201_CREATED)


class CartItemDetailView(APIView):
    """PUT / DELETE /api/orders/cart/items/{id}/"""
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, pk):
        cart = get_object_or_404(Cart, user=request.user)
        item = get_object_or_404(CartItem, id=pk, cart=cart)
        try:
            quantity = int(request.data.get('quantity', 1))
        except (ValueError, TypeError):
            return Response({'error': 'Quantité invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        if quantity <= 0:
            item.delete()
        else:
            if item.product.stock_quantity < quantity:
                return Response({'error': 'Stock insuffisant.'}, status=status.HTTP_409_CONFLICT)
            item.quantity = quantity
            item.save()
        # Refresh the cart from DB before serializing
        cart.refresh_from_db()
        return cart_response(cart, request)

    def delete(self, request, pk):
        cart = get_object_or_404(Cart, user=request.user)
        item = get_object_or_404(CartItem, id=pk, cart=cart)
        item.delete()
        # FIX: renvoie le panier mis à jour (le frontend peut recalculer)
        cart.refresh_from_db()
        return cart_response(cart, request)


class CartClearView(APIView):
    """DELETE /api/orders/cart/clear/ → Vider le panier"""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        cart = get_object_or_404(Cart, user=request.user)
        cart.items.all().delete()
        return Response({'message': 'Panier vidé.'})


# ─────────────────────────────────────────────────────────────
#  COMMANDES
# ─────────────────────────────────────────────────────────────

class OrderListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/orders/    → Mes commandes (ou toutes si admin + search + pagination)
    POST /api/orders/    → Créer une commande depuis le panier
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = OrderSerializer
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    # Admin: recherche par référence, email client, téléphone, ville
    search_fields      = ['id', 'user__email', 'user__first_name', 'user__last_name',
                          'user__phone', 'shipping_city', 'shipping_full_name']
    ordering_fields    = ['created_at', 'total_amount', 'status']
    ordering           = ['-created_at']

    def get_queryset(self):
        qs = Order.objects.prefetch_related(
            'items__product__images', 'status_history__changed_by'
        ).select_related('user')

        if getattr(self.request.user, 'is_admin', False):
            # Admin : toutes les commandes avec filtre optionnel par status
            status_filter = self.request.query_params.get('status')
            if status_filter:
                qs = qs.filter(status=status_filter)
            return qs.all()

        return qs.filter(user=self.request.user)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cart = get_object_or_404(Cart, user=request.user)
        cart_items = cart.items.select_related('product').all()

        if getattr(request.user, 'is_suspended', False):
            return Response({
                'error': f"Votre compte est suspendu jusqu'au "
                        f"{request.user.suspended_until.strftime('%d/%m/%Y')}. "
                        f"Vous ne pouvez pas passer de commande.",
                'suspended_until': request.user.suspended_until,
            }, status=status.HTTP_403_FORBIDDEN)

        if not cart_items.exists():
            return Response({'error': 'Votre panier est vide.'}, status=status.HTTP_400_BAD_REQUEST)

        # ── Vérifier le stock ─────────────────────────────────
        errors = []
        for item in cart_items:
            if item.product.stock_quantity < item.quantity:
                errors.append(
                    f"'{item.product.name}' : stock disponible {item.product.stock_quantity}, "
                    f"demandé {item.quantity}"
                )
        if errors:
            return Response({'errors': errors}, status=status.HTTP_409_CONFLICT)

        
        # total    = subtotal + shipping + tva

        # ── Adresse de livraison ──────────────────────────────
        shipping_address = None
        addr_id = serializer.validated_data.get('shipping_address_id')
        shipping_info = data.get('shipping_info', {})

        if addr_id:
            shipping_address = get_object_or_404(Address, id=addr_id, user=request.user)
            snap = {
                'shipping_full_name':    shipping_address.full_name,
                'shipping_address_line': shipping_address.address_line,
                'shipping_city':         shipping_address.city,
                'shipping_postal_code':  shipping_address.postal_code,
                'shipping_phone':        shipping_address.phone,
                'shipping_country':      shipping_address.country,
            }
        elif shipping_info:
            # Créer/mettre à jour l'adresse depuis le formulaire checkout
            addr, created = Address.objects.get_or_create(
                user=request.user,
                city=shipping_info.get('city', ''),
                address_line=shipping_info.get('address_line', ''),
                defaults={
                    'full_name':    shipping_info.get('full_name', request.user.get_full_name()),
                    'phone':        shipping_info.get('phone', request.user.phone),
                    'postal_code':  shipping_info.get('postal_code', ''),
                    'country':      'Tunisie',
                    'is_default':   True,
                }
            )
            shipping_address = addr
            snap = {
                'shipping_full_name':    addr.full_name,
                'shipping_address_line': addr.address_line,
                'shipping_city':         addr.city,
                'shipping_postal_code':  addr.postal_code,
                'shipping_phone':        addr.phone,
                'shipping_country':      addr.country,
            }
            # Mettre à jour le profil user avec l'adresse la plus récente
            User.objects.filter(pk=request.user.pk).update(
                address=addr.address_line,
                city=addr.city,
                postal_code=addr.postal_code,
            )
        else:
            snap = {}


        # ── Calculer le prix de livraison ─────────────────────
        subtotal = sum(item.product.price * item.quantity for item in cart_items)
        shipping = SHIPPING_COST if subtotal < SHIPPING_THRESHOLD else Decimal('0.00')
        tva      = TVA_TIMBRE
        # ── Créer la commande ─────────────────────────────────
        order = Order.objects.create(
            user=request.user,
            order_number=Order.generate_order_number(),
            shipping_address=shipping_address,
            notes=serializer.validated_data.get('notes', ''),
            shipping_cost=shipping,
            tva_timbre=tva,
            **snap
        )

        # subtotal = 0
        for item in cart_items:
            OrderItem.objects.create(
                order=order,
                product=item.product,
                product_name=item.product.name,
                unit_price=item.product.price,
                quantity=item.quantity,
            )
            # subtotal += item.product.price * item.quantity

            Product.objects.filter(pk=item.product.pk).update(
                stock_quantity=item.product.stock_quantity - item.quantity,
                purchase_count=item.product.purchase_count + item.quantity
            )

        order.subtotal     = subtotal
        order.total_amount = subtotal + shipping + tva
        order.save()

        Payment.objects.create(
            order=order,
            method=data.get('payment_method', Payment.Method.COD),
            amount=order.total_amount,
            idinar_number=data.get('idinar_number', ''),
        )

        # ── Vider le panier ───────────────────────────────────
        cart.items.all().delete()

        try:
            # Email admin — notification immédiate
            send_admin_notification(
                order, 'admin_new_order.html', 
                f"Nouvelle commande {order.order_number} — {order.total_amount} DT", 
                request
            )
        except Exception as e:
            logger.error("❌ Email admin nouvelle commande %s : %s\n%s",
                        order.order_number, e, traceback.format_exc())


        return Response(
            OrderSerializer(order, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )

    # mes commandes
    @action(methods=['GET'], detail=False, permission_classes=[permissions.IsAuthenticated], url_path='my-orders')
    def my_orders(self, request):
        orders = Order.objects.filter(user=request.user).order_by('-created_at')
        return Response(OrderSerializer(orders, many=True).data)
    
class OrderDetailView(generics.RetrieveAPIView):
    """GET /api/orders/{id}/ → Détail d'une commande"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = OrderSerializer

    def get_queryset(self):
        qs = Order.objects.prefetch_related(
            'items__product__images', 'status_history__changed_by'
        )
        if getattr(self.request.user, 'is_admin', False):
            return qs.all()
        return qs.filter(user=self.request.user)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

class OrderStatusUpdateView(APIView):
    """
    PATCH /api/orders/<id>/status/
    Réservé aux admins — met à jour le statut d'une commande
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not getattr(request.user, 'is_admin', False):
            return Response({'error': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)
        order = get_object_or_404(Order, pk=pk)
        new_status = request.data.get('status').strip()
        note = request.data.get('notes', '')
        valid = [s[0] for s in Order.Status.choices]

        if not new_status:
            return Response({'error': 'Champ status requis.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_status not in valid:
            return Response({'error': f'Statut invalide. Valeurs : {valid}'},
                status=status.HTTP_400_BAD_REQUEST)
        
        if new_status == "SHIPPED" and not order.delivery_date:
            return Response({'error': "Une date de livraison prévue est requise avant d'expédier la commande."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Vérifier que la transition est valide
        if not order.can_transition_to(new_status):
            return Response({
                'error': f"Transition interdite : {order.status} → {new_status}",
                'transitions_valides': order.VALID_TRANSITIONS.get(order.status, [])
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            order.transition_status(new_status, changed_by=request.user, note=note)

        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # ── Email suivi client ────────────────────────────────
        EMAIL_TEMPLATES = {
            'CONFIRMED':  ('order_confirmed.html',  f'Commande {order.order_number} confirmée'),
            # 'PROCESSING': ('order_processing.html', f'🔧 Commande {order.order_number} en préparation'),
            'SHIPPED':    ('order_shipped.html',    f'Commande {order.order_number} expédiée'),
            'DELIVERED':  ('order_delivered.html',  f'Commande {order.order_number} livrée'),
            'CANCELLED':  ('order_cancelled.html',  f'Commande {order.order_number} annulée'),
        }
        if new_status in EMAIL_TEMPLATES:
            template, subject = EMAIL_TEMPLATES[new_status]
            try:
                send_order_email(order, template, subject, request)
            except Exception as e:
                logger.error("❌ Email client [%s] échec : %s\n%s", new_status, e, traceback.format_exc())


        order.refresh_from_db()
        return Response(OrderSerializer(order, context={'request': request}).data)

class OrderCancelView(APIView):
    """
    POST /api/orders/<id>/cancel/
    Client — annulation si le statut le permet.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk, user=request.user)

        if not order.can_client_cancel():
            return Response({
                'error':  f"Impossible d'annuler une commande au statut '{order.get_status_display()}'.",
                'detail': 'Annulation possible uniquement si En attente, Confirmée ou En préparation.',
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            order.transition_status('CANCELLED', changed_by=request.user, note='Annulée par le client')
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Remettre le stock
        for item in order.items.all():
            Product.objects.filter(pk=item.product.pk).update(
                stock_quantity=item.product.stock_quantity + item.quantity,
                purchase_count=max(0, item.product.purchase_count - item.quantity),
            )

        send_order_email(
            order,
            'order_cancelled.html',
            f'Commande {order.order_number} annulée',
            request
        )

        send_admin_notification(
            order, 'order_cancelled_admin.html', 
            f'Annulation client — Commande {order.order_number}',
            request
        )
        return Response(OrderSerializer(order, context={'request': request}).data)


class OrderMissedDeliveryView(APIView):
    """
    POST /api/orders/<pk>/missed-delivery/
    Admin — enregistre une absence à la livraison.

    Body (optionnel) :
      { "new_delivery_date": "2026-04-10" }

    Règles :
      attempts 0→1 : 1ère absence, admin peut fixer une nouvelle date
                     → statut repasse SHIPPED→PROCESSING si date fournie
      attempts 1→2 : 2ème absence, no_more_delivery=True
                     → plus possible de passer à SHIPPED pour cette commande
      attempts ≥ 2 : idempotent, ne fait rien
    
    Comptage global par user :
      Si le client a >= 3 commandes avec no_more_delivery=True
      → suspended_until = now() + 90 jours
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not getattr(request.user, 'is_admin', False):
            return Response({'error': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        order = get_object_or_404(Order, pk=pk)

        if order.status not in ('SHIPPED', 'PROCESSING'):
            return Response({
                'error': "L'absence à la livraison ne s'enregistre que pour une commande Expédiée ou En préparation."
            }, status=status.HTTP_400_BAD_REQUEST)

        if order.no_more_delivery:
            return Response({
                'error': "Cette commande a déjà épuisé ses tentatives de livraison.",
                'delivery_attempts': order.delivery_attempts,
                'no_more_delivery': True,
            }, status=status.HTTP_400_BAD_REQUEST)

        # Nouvelle date optionnelle
        new_date_str = request.data.get('new_delivery_date')
        new_date = None
        if new_date_str:
            from datetime import date
            try:
                new_date = date.fromisoformat(new_date_str)
                if new_date <= date.today():
                    return Response(
                        {'error': 'La nouvelle date doit être dans le futur.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except ValueError:
                return Response(
                    {'error': 'Format de date invalide. Attendu : YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        attempts_after, no_more = order.record_missed_delivery(
            changed_by=request.user,
            new_delivery_date=new_date,
        )

        # Email au client
        if no_more:
            try:
                send_order_email(
                    order,
                    'order_no_more_delivery.html',
                    f'Commande {order.order_number} — Plus de livraison possible',
                    request
                )
            except Exception:
                pass
        elif new_date:
            try:
                send_order_email(
                    order,
                    'order_redelivery.html',
                    f'Commande {order.order_number} — Nouvelle date de livraison',
                    request
                )
            except Exception:
                pass

        # Vérifier si user suspendu et notifier les admins
        order.user.refresh_from_db()
        if order.user.suspended_until:
            send_admin_notification(
                order,
                'user_suspended_admin.html',
                f'Client suspendu — {order.user.get_full_name()}',
                request
            )

        order.refresh_from_db()
        return Response({
            **OrderSerializer(order, context={'request': request}).data,
            'delivery_attempts': attempts_after,
            'no_more_delivery':  no_more,
            'user_suspended':    bool(order.user.suspended_until),
        })


class OrderDeliveryDateView(APIView):
    """
    PATCH /api/orders/<pk>/delivery-date/
    Admin — met à jour la date de livraison prévue sans enregistrer d'absence.
    Utilisé pour la planification initiale.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not getattr(request.user, 'is_admin', False):
            return Response({'error': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        order = get_object_or_404(Order, pk=pk)
        date_str = request.data.get('delivery_date', '').strip()

        if not date_str:
            return Response({'error': 'delivery_date requis.'}, status=status.HTTP_400_BAD_REQUEST)

        from datetime import date
        try:
            new_date = date.fromisoformat(date_str)
        except ValueError:
            return Response({'error': 'Format invalide. Attendu : YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        order.delivery_date = new_date
        order.save(update_fields=['delivery_date', 'updated_at'])

        return Response({
            'order_number':  order.order_number,
            'delivery_date': str(order.delivery_date),
        })
    