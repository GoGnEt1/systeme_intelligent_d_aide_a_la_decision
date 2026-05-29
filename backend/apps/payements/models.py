from django.db import models
from apps.orders.models import Order

# Create your models here.
class Payment(models.Model):
    """
    Paiement associé à une commande.

    Modes disponibles (contexte tunisien) :
    - COD      : Cash on Delivery (paiement à la livraison)
    - MOBILE   : Paiement mobile — ID17 carte i-Dinar
    - CARD     : Carte bancaire (Visa/Mastercard)
    """

    class Method(models.TextChoices):
        COD    = 'COD',    'Paiement à la livraison'
        MOBILE = 'MOBILE', 'Paiement mobile (i-Dinar)'
        CARD   = 'CARD',   'Carte bancaire'

    class PayStatus(models.TextChoices):
        PENDING   = 'PENDING',   'En attente'
        COMPLETED = 'COMPLETED', 'Complété'
        FAILED    = 'FAILED',    'Échoué'
        REFUNDED  = 'REFUNDED',  'Remboursé'

    order      = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment')
    method     = models.CharField(max_length=10, choices=Method.choices)
    status     = models.CharField(max_length=10, choices=PayStatus.choices, default=PayStatus.PENDING)
    amount     = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Pour MOBILE — numéro i-Dinar (ID17 = 17 chiffres)
    idinar_number = models.CharField(max_length=20, blank=True)

    # Pour CARD — on ne stocke JAMAIS les données complètes
    # On stocke seulement les 4 derniers chiffres + token de paiement
    card_last4        = models.CharField(max_length=4, blank=True)
    card_brand        = models.CharField(max_length=20, blank=True)   # Visa / Mastercard
    payment_token     = models.CharField(max_length=200, blank=True)  # token Stripe/Konnect

    # Référence de transaction externe
    transaction_ref   = models.CharField(max_length=200, blank=True, unique=True, null=True)

    class Meta:
        db_table      = "payments"
        verbose_name  = "Paiement"
        verbose_name_plural = "Paiements"

    def __str__(self):
        return f"{self.get_method_display()} — {self.order.order_number} ({self.get_status_display()})"

    def mark_completed(self, transaction_ref: str = ""):
        """Marquer le paiement comme complété"""
        self.status = self.PayStatus.COMPLETED
        if transaction_ref:
            self.transaction_ref = transaction_ref
        self.save()

    def mark_refunded(self):
        """Marquer le paiement comme remboursé"""
        self.status = self.PayStatus.REFUNDED
        self.save()