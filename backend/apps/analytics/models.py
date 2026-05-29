"""
=============================================================
 backend/apps/analytics/models.py  — Sprint S4
 Modèles : CustomerSegment, GiftOffer
=============================================================
"""

from django.db import models
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from apps.users.models import User


class CustomerSegment(models.Model):
    """
    Résultat de la segmentation RFM/K-Means pour un client.
    
    Cette table est remplie par :
    1. Le notebook Sprint 4 (via upsert SQL direct)
    2. L'endpoint FastAPI /ml/resegment (background task)
    3. Tâche Celery trimestrielle (Sprint S4)
    
    Mise à jour : chaque trimestre (MAJ automatique)
    """
    SEGMENT_CHOICES = [
        ('champions', '🏆 Champions'),
        ('loyaux',    '💙 Loyaux'),
        ('a_risque_perdus',  '⚠️ À risque / Perdus'),
        # ('nouveau',   '🆕 Nouveau'),
    ]

    # Lien vers le modèle User (nullable : certains users peuvent être anonymes/supprimés)
    user        = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='segment',
        null=True, blank=True,
    )
    # ── Métriques RFM ────────────────────────────────────────
    recency_days    = models.IntegerField(help_text="Jours depuis le dernier achat")
    frequency       = models.IntegerField(help_text="Nombre de commandes total")
    monetary        = models.DecimalField(max_digits=12, decimal_places=3, help_text="Montant total dépensé (DT)")
    avg_order_value = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)

    # ── Résultat K-Means ─────────────────────────────────────
    cluster_id      = models.IntegerField(default=0)
    segment         = models.CharField(max_length=30, choices=SEGMENT_CHOICES, db_index=True)
    segment_label   = models.CharField(max_length=60, blank=True)
    
    computed_at     = models.DateTimeField(default=timezone.now,
                                           verbose_name="Date de calcul")
    model_version   = models.CharField(max_length=30, default='kmeans_ss_v1_k4',
                                       verbose_name="Version du modèle")

    class Meta:
        db_table = "analytics_customersegment"
        verbose_name = "Segment client"
        verbose_name_plural = "Segments clients"
        ordering = ["cluster_id", "-monetary"]
        indexes = [
            models.Index(fields=["cluster_id"]),
            models.Index(fields=["segment"]),
            models.Index(fields=["-monetary"]),
        ]

    def __str__(self):
        return f"[{self.segment_label}] Client {self.user} — {self.monetary} DT"

    @property
    def rfm_summary(self) -> dict:
        return {
            "recency":   self.recency_days,
            "frequency": self.frequency,
            "monetary":  float(self.monetary),
        }

class GiftOffer(models.Model):
    """
    Offre cadeau créée par l'admin pour un client top.
    
    Cycle de vie :
    PENDING → SENT (email envoyé) → ACCEPTED | DECLINED | EXPIRED
    
    L'admin choisit :
    - Le type de cadeau (réduction, article gratuit, livraison, points)
    - La valeur
    - La durée de validité
    
    Le client est notifié par email et peut accepter/refuser.
    """

    class GiftType(models.TextChoices):
        DISCOUNT  = 'discount',  'Réduction (%)'
        PRODUCT   = 'product',   'Article gratuit'
        SHIPPING  = 'shipping',  'Livraison offerte'
        POINTS    = 'points',    'Points fidélité'
        VOUCHER   = 'voucher',   'Bon d\'achat (DT)'

    class Status(models.TextChoices):
        PENDING   = 'pending',   'En attente d\'envoi'
        SENT      = 'sent',      'Email envoyé'
        ACCEPTED  = 'accepted',  'Acceptée par le client'
        DECLINED  = 'declined',  'Refusée par le client'
        EXPIRED   = 'expired',   'Expirée'

    # ── Relation client ────────────────────────────────────────────────────
    user            = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='gift_offers',
        verbose_name="Client"
    )
    segment         = models.CharField(max_length=30, verbose_name="Segment au moment de l'offre")
    rank            = models.IntegerField(default=0, verbose_name="Classement (1=meilleur)")

    # ── Détails de l'offre ─────────────────────────────────────────────────
    gift_type       = models.CharField(max_length=20, choices=GiftType.choices,
                                       verbose_name="Type de cadeau")
    gift_value      = models.DecimalField(max_digits=10, decimal_places=2,
                                          verbose_name="Valeur (% ou DT)")
    gift_details    = models.TextField(verbose_name="Description de l'offre")
    admin_note      = models.TextField(blank=True, verbose_name="Note interne admin")

    # ── Gestion temporelle ─────────────────────────────────────────────────
    valid_days      = models.IntegerField(default=7, verbose_name="Durée de validité (jours)")
    created_at      = models.DateTimeField(auto_now_add=True)
    sent_at         = models.DateTimeField(null=True, blank=True)
    expires_at      = models.DateTimeField(null=True, blank=True)
    responded_at    = models.DateTimeField(null=True, blank=True)

    # ── Statut ────────────────────────────────────────────────────────────
    status          = models.CharField(max_length=20, choices=Status.choices,
                                       default=Status.PENDING,
                                       db_index=True,
                                       verbose_name="Statut")
    token           = models.CharField(max_length=64, unique=True, blank=True,
                                       verbose_name="Token sécurisé (lien email)")

    class Meta:
        db_table = "analytics_giftoffer"
        verbose_name = "Offre cadeau"
        verbose_name_plural = "Offres cadeaux"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Offre [{self.gift_type}] → {self.user.email} [{self.status}]"

    def is_expired(self):
        return self.expires_at and timezone.now() > self.expires_at

    def save(self, *args, **kwargs):
        if not self.token:
            import secrets
            self.token = secrets.token_urlsafe(48)
        if self.sent_at and not self.expires_at:
            self.expires_at = self.sent_at + timedelta(days=self.valid_days)
        super().save(*args, **kwargs)