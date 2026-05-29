"""
=============================================================
 apps/users/models.py
 Modèle utilisateur personnalisé
 
 POURQUOI personnaliser ?
 - Utiliser l'email comme identifiant (au lieu de username)
 - Ajouter des champs métier : rôle, adresse, téléphone
 - Rester flexible pour les évolutions futures
=============================================================
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.conf import settings
from datetime import timedelta


class UserManager(BaseUserManager):
    """
    Manager personnalisé : remplace username par email
    """
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("L'email est obligatoire")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)   # hash le mot de passe automatiquement
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.Role.ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Modèle utilisateur central.
    
    Champs clés :
    - email : identifiant unique
    - role  : CLIENT ou ADMIN (contrôle les permissions)
    - rfm_segment : mis à jour par le module ML Segmentation
    """
    
    class Role(models.TextChoices):
        CLIENT = 'CLIENT', 'Client'
        ADMIN  = 'ADMIN',  'Administrateur'

    # ── Identification ──────────────────────────────────────
    email = models.EmailField(unique=True, verbose_name="Email")
    first_name = models.CharField(max_length=100, verbose_name="Prénom")
    last_name = models.CharField(max_length=100, verbose_name="Nom")
    phone = models.CharField(max_length=20, blank=True, verbose_name="Téléphone")
    
    # ── Rôle ────────────────────────────────────────────────
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.CLIENT,
        verbose_name="Rôle"
    )
    
    # ── Adresse principale ──────────────────────────────────
    address = models.TextField(blank=True, verbose_name="Adresse")
    city = models.CharField(max_length=100, blank=True, verbose_name="Ville")
    postal_code = models.CharField(max_length=10, blank=True, verbose_name="Code postal")
    
    # ── Champ ML : segment calculé par K-Means/RFM ──────────
    # Valeurs possibles : 'champion', 'loyal', 'at_risk', 'new'
    rfm_segment = models.CharField(max_length=50, blank=True, verbose_name="Segment RFM")
    rfm_score = models.FloatField(null=True, blank=True, verbose_name="Score RFM")
    
    # ── Métadonnées système ──────────────────────────────────
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    # quand le client accumule >= 3 commandes abandonnées
    suspended_until = models.DateTimeField(
        null=True, blank=True,
        verbose_name="Suspendu jusqu'au"
    )

    # ── Configuration Django ────────────────────────────────
    objects = UserManager()
    USERNAME_FIELD  = 'email'           # login par email
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        db_table = "users"

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}>"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN
    
    @property
    def is_client(self):
        return self.role == self.Role.CLIENT
    
    @property
    def is_suspended(self) -> bool:
        """True si le compte est en période de suspension active."""
        if not self.suspended_until:
            return False
        return timezone.now() < self.suspended_until

    @property
    def suspension_days_remaining(self) -> int:
        """Nombre de jours restants de suspension (0 si non suspendu)."""
        if not self.is_suspended:
            return 0
        delta = self.suspended_until - timezone.now()
        return max(0, delta.days)



class PasswordResetCode(models.Model):
    """
    Code d'authentification à deux facteurs pour les mot de passe oubliés
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="authentification_2F")
    code = models.CharField(max_length=10)
    create_at = models.DateTimeField(auto_now_add=True)
    attemps = models.IntegerField(default=0)
    is_used = models.BooleanField(default=False)

    def is_valid(self):
        if self.is_used:
            return False
        return timezone.now() - self.create_at < timedelta(seconds=settings.PASSWORD_RESET_CODE_EXPIRATION_SECONDS)

class Address(models.Model):
    """
    Carnet d'adresses : un client peut avoir plusieurs adresses
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')
    label = models.CharField(max_length=50, default='Domicile')
    full_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20)
    address_line = models.TextField()
    city = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=10)
    country = models.CharField(max_length=50, default='Tunisie')
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Adresse"
        db_table = "user_addresses"
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.label} — {self.full_name} ({self.city})"
    
    def save(self, *args, **kwargs):
        # Si cette adresse est définie par défaut, retirer le défaut des autres
        if self.is_default:
            Address.objects.filter(user=self.user, is_default=True).update(is_default=False)
        super().save(*args, **kwargs)
