"""
=============================================================
 apps/orders/models.py
 Modèles : Panier, Commande, Ligne de commande
=============================================================
"""

from django.db import models
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from apps.users.models import User, Address
from apps.products.models import Product
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta

# ── Constantes tarifaires (Tunisie) ───────────────────────────
SHIPPING_THRESHOLD = Decimal('300.00')   # seuil livraison gratuite (DT)
SHIPPING_COST      = Decimal('8.00')     # frais de livraison (DT)
TVA_TIMBRE         = Decimal('1.00')     # TVA/timbre fiscal (DT)

MAX_DELIVERY_ATTEMPTS   = 2   # 1 normal + 1 retard max
MAX_ABSENCES_FOR_BAN    = 3   # nb de commandes "abandon" avant suspension

class Cart(models.Model):
    """
    Panier temporaire d'un client.
    Un client = un seul panier actif à la fois.
    """
    user       = models.OneToOneField(User, on_delete=models.CASCADE, related_name='cart')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "carts"

    def get_total(self):
        return sum(item.get_subtotal() for item in self.items.all())

    def get_item_count(self):
        return sum(item.quantity for item in self.items.all())

    def get_shipping_cost(self):
        """8 DT si sous le seuil de 300 DT, sinon gratuit"""
        return SHIPPING_COST if self.get_total() < SHIPPING_THRESHOLD else Decimal('0.00')

    def get_grand_total(self):
        return self.get_total() + self.get_shipping_cost() + TVA_TIMBRE

    def __str__(self):
        return f"Panier de {self.user.get_full_name()}"


class CartItem(models.Model):
    """Ligne d'un panier"""
    cart       = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product    = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity   = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    added_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cart_items"
        unique_together = ['cart', 'product']

    def get_subtotal(self):
        return self.product.price * self.quantity


class Order(models.Model):
    """
    Commande validée.
    
    Cycle de vie du statut :
    PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
                       ↘ CANCELLED
    Un client peut annuler si statut ∉ {SHIPPED, DELIVERED, CANCELLED, REFUNDED}
    """
    
    class Status(models.TextChoices):
        PENDING    = 'PENDING',    'En attente'
        CONFIRMED  = 'CONFIRMED',  'Confirmée'
        PROCESSING = 'PROCESSING', 'En préparation'
        SHIPPED    = 'SHIPPED',    'Expédiée'
        DELIVERED  = 'DELIVERED',  'Livrée'
        CANCELLED  = 'CANCELLED',  'Annulée'
        REFUNDED   = 'REFUNDED',   'Remboursée'

    # Transitions valides : {statut_actuel: [statuts_possibles]}
    VALID_TRANSITIONS = {
        'PENDING':    ['CONFIRMED', 'CANCELLED'],
        'CONFIRMED':  ['PROCESSING', 'CANCELLED'],
        'PROCESSING': ['SHIPPED', 'CANCELLED'],
        'SHIPPED':    ['DELIVERED'],
        'DELIVERED':  ['REFUNDED'],
        'CANCELLED':  [],
        'REFUNDED':   [],
    }
     
    # Statuts où le client peut encore annuler
    CLIENT_CANCELLABLE = {'PENDING', 'CONFIRMED', 'PROCESSING'}

    # ── Relations ────────────────────────────────────────────
    user            = models.ForeignKey(User, on_delete=models.PROTECT, related_name='orders')
    shipping_address = models.ForeignKey(
        Address, on_delete=models.PROTECT,
        null=True, blank=True, related_name='orders'
    )
    
    # ── Référence & statut ────────────────────────────────────
    order_number    = models.CharField(max_length=50, unique=True)
    status          = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    
    # ── Montants ─────────────────────────────────────────────
    subtotal        = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    shipping_cost   = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tva_timbre      = models.DecimalField(max_digits=10, decimal_places=2, default=TVA_TIMBRE)
    
    # ── Notes ────────────────────────────────────────────────
    notes           = models.TextField(blank=True)
    
    # ── Dates ────────────────────────────────────────────────
    # created_at      = models.DateTimeField(auto_now_add=True)
    created_at      = models.DateTimeField(default=timezone.now, editable=False)
    updated_at      = models.DateTimeField(auto_now=True)
    delivered_at    = models.DateTimeField(null=True, blank=True)

    # Snapshot adresse de livraison (au cas où l'adresse change après)
    shipping_full_name   = models.CharField(max_length=200, blank=True)
    shipping_address_line = models.TextField(blank=True)
    shipping_city        = models.CharField(max_length=100, blank=True)
    shipping_postal_code = models.CharField(max_length=10, blank=True)
    shipping_phone       = models.CharField(max_length=20, blank=True)
    shipping_country     = models.CharField(max_length=50, default='Tunisie')

    # ── Livraison — gestion des absences ──────────────────────
    delivery_date = models.DateField(null=True, blank=True,
                    verbose_name="Date de livraison prévue")
    delivery_attempts = models.PositiveSmallIntegerField(default=0,
                        verbose_name="Tentatives de livraison")
    no_more_delivery  = models.BooleanField(default=False, 
                        verbose_name="Abandon — plus de livraison")

    class Meta:
        verbose_name = "Commande"
        verbose_name_plural = "Commandes"
        db_table = "orders"
        ordering = ['-created_at']

    def __str__(self):
        return f"Commande {self.order_number} — {self.user.get_full_name()}"

    def can_transition_to(self, new_status: str) -> bool:
        """Vérifie si la transition de statut est valide"""
        if new_status == 'SHIPPED' and self.no_more_delivery:
            return False
        return new_status in self.VALID_TRANSITIONS.get(self.status, [])

    def transition_status(self, new_status: str, changed_by: User, note: str = None):
        """
        Change le statut avec validation + enregistrement de l'historique.
        Lève ValidationError si la transition est interdite.
        """
        if not self.can_transition_to(new_status):
            reason = " (client a épuisé ses tentatives de livraison)" if self.no_more_delivery else ""
            raise ValidationError(
                f"Transition interdite : {self.status} → {new_status}{reason}. "
                f"Transitions valides : {self.VALID_TRANSITIONS.get(self.status, [])}"
            )
        old_status = self.status
        self.status = new_status
        if new_status == self.Status.DELIVERED:
            self.delivered_at = timezone.now()
        self.save(update_fields=['status', 'delivered_at', 'updated_at'])

        # Enregistrer qui a changé quoi
        OrderStatusHistory.objects.create(
            order=self,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by,
            note=note
        )
        return self

    
    def record_missed_delivery(self, changed_by, new_delivery_date=None):
        """
        Enregistre une absence à la livraison.

        Règles :
          attempts == 0 → 1er passage normal, on incrémente → attempts=1
                          l'admin peut fixer une nouvelle date (2ème chance)
          attempts == 1 → 2ème passage (retard), on incrémente → attempts=2
                          no_more_delivery=True : plus de livraison possible
          attempts >= 2 → déjà épuisé, ne fait rien

        Retourne (attempts_after, no_more_delivery)
        """
        if self.delivery_attempts >= MAX_DELIVERY_ATTEMPTS:
            return self.delivery_attempts, self.no_more_delivery

        self.delivery_attempts += 1
        note = f"Absence à la livraison (tentative {self.delivery_attempts}/{MAX_DELIVERY_ATTEMPTS})"

        if self.delivery_attempts >= MAX_DELIVERY_ATTEMPTS:
            self.no_more_delivery = True
            note += " — plus de livraison possible pour cette commande"
        elif new_delivery_date:
            self.delivery_date = new_delivery_date
            note += f" — nouvelle date fixée : {new_delivery_date}"

        self.save(update_fields=['delivery_attempts', 'delivery_date', 'no_more_delivery', 'updated_at'])

        # Repasser SHIPPED → PROCESSING si nouvelle date définie (re-expédition planifiée)
        if not self.no_more_delivery and self.status == 'SHIPPED' and new_delivery_date:
            old_status  = self.status
            self.status = 'PROCESSING'
            self.save(update_fields=['status', 'updated_at'])
            OrderStatusHistory.objects.create(
                order=self,
                old_status=old_status,
                new_status='PROCESSING',
                changed_by=changed_by,
                note=note,
            )
        else:
            # Juste enregistrer la note dans l'historique sans changer le statut
            OrderStatusHistory.objects.create(
                order=self,
                old_status=self.status,
                new_status=self.status,  # statut inchangé
                changed_by=changed_by,
                note=note,
            )

        # Vérifier si ce client accumule trop d'absences → suspension
        self._check_user_absences(changed_by)

        return self.delivery_attempts, self.no_more_delivery

    def _check_user_absences(self, checked_by):
        """
        Compte le total de commandes 'abandon' (no_more_delivery=True)
        pour ce client. Si >= MAX_ABSENCES_FOR_BAN, programme la suspension.
        """
        abandon_count = Order.objects.filter(
            user=self.user,
            no_more_delivery=True
        ).count()

        if abandon_count >= MAX_ABSENCES_FOR_BAN:
            suspension_date = timezone.now() + timedelta(days=90)  # 3 mois
            # On stocke la date dans le modèle User (champ à ajouter)
            User.objects.filter(pk=self.user.pk).update(
                suspended_until=suspension_date
            )


    def can_client_cancel(self) -> bool:
        return self.status in self.CLIENT_CANCELLABLE
    
    def calculate_total(self):
        self.subtotal = sum(item.get_subtotal() for item in self.items.all())
        self.total_amount = self.subtotal + self.shipping_cost - self.discount_amount
        self.save()

    @classmethod
    def generate_order_number(cls):
        import random, string
        return 'SS-' + ''.join(random.choices(string.digits, k=10))


class OrderItem(models.Model):
    """Ligne d'une commande (snapshot du produit au moment de l'achat)"""
    order        = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product      = models.ForeignKey(Product, on_delete=models.PROTECT)
    product_name = models.CharField(max_length=500)   # snapshot nom
    unit_price   = models.DecimalField(max_digits=10, decimal_places=2)  # snapshot prix
    quantity     = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        db_table = "order_items"

    def get_subtotal(self):
        return self.unit_price * self.quantity

    def __str__(self):
        return f"{self.quantity}× {self.product_name}"

class OrderStatusHistory(models.Model):
    """
    Audit trail des changements de statut.
    Permet d'éviter les conflits entre admins et de tracer les responsabilités.
    """
    order      = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    old_status = models.CharField(max_length=15)
    new_status = models.CharField(max_length=15)
    changed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='status_changes'
    )
    changed_at = models.DateTimeField(auto_now_add=True)
    note       = models.TextField(blank=True)  # commentaire optionnel de l'admin

    class Meta:
        db_table = "order_status_history"
        ordering = ['-changed_at']

    def __str__(self):
        who = self.changed_by.get_full_name() if self.changed_by else "Système"
        return f"[{self.order.order_number}] {self.old_status}→{self.new_status} par {who}"

