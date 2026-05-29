"""
=============================================================
 apps/users/serializers.py
 Sérialisation : Python objects ↔ JSON
 
 RÔLE d'un Serializer (DRF) :
 - Valide les données entrantes (comme un formulaire)
 - Convertit les objets Django en JSON (pour les réponses)
 - Gère les règles métier (ex: unicité email)
=============================================================
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from .models import User, Address


class RegisterSerializer(serializers.ModelSerializer):
    """
    Inscription d'un nouvel utilisateur.
    
    password2 est un champ de confirmation — il n'existe pas en DB,
    on le définit manuellement avec write_only=True.
    """
    password  = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, label="Confirmation mot de passe")

    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'phone', 'password', 'password2']

    def validate(self, attrs):
        """Validation croisée : les deux mots de passe doivent correspondre"""
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Les mots de passe ne correspondent pas."})
        return attrs

    def create(self, validated_data):
        """Création de l'utilisateur avec le mot de passe hashé"""
        validated_data.pop('password2')  # Supprimer le champ de confirmation
        user = User.objects.create_user(**validated_data)
        return user


class UserSerializer(serializers.ModelSerializer):
    """
    Lecture des infos utilisateur (profil).
    read_only = jamais modifiable via cette API.
    """
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'phone', 'role', 'rfm_segment', 'rfm_score',
            'address', 'city', 'postal_code', 'date_joined'
        ]
        read_only_fields = ['id', 'role', 'rfm_segment', 'rfm_score', 'date_joined']


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    JWT enrichi : on ajoute les infos user dans la réponse de login.
    
    Réponse standard JWT :
    { "access": "...", "refresh": "..." }
    
    Notre réponse enrichie :
    { "access": "...", "refresh": "...", "user": { infos complètes } }
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        # Ajouter les données utilisateur à la réponse
        data['user'] = UserSerializer(self.user).data
        return data
    
    @classmethod
    def get_token(cls, user):
        """Ajouter des claims personnalisés dans le payload JWT"""
        token = super().get_token(user)
        # Claims dans le token (décodables côté frontend)
        token['email'] = user.email
        token['role'] = "ADMIN" if user.is_staff else user.role
        token['full_name'] = user.get_full_name()
        return token


class AddressSerializer(serializers.ModelSerializer):
    TUNISIAN_CITIES = [
        'Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte', 'Gabès',
        'Ariana', 'Gafsa', 'Monastir', 'Ben Arous', 'Kasserine', 'Médenine',
        'Nabeul', 'Tataouine', 'Béja', 'Jendouba', 'El Kef', 'Mahdia',
        'Sidi Bouzid', 'Tozeur', 'Siliana', 'Zaghouan', 'Kebili', 'Manouba',
    ]
    TUNISIAN_POSTAL_REGEX = r'^\d{4}$'  # code postal tunisien = 4 chiffres

    class Meta:
        model  = Address
        fields = '__all__'
        read_only_fields = ['user', 'created_at']

    def validate_country(self, value):
        """Le pays doit être Tunisie (insensible à la casse)"""
        if value.strip().lower() not in ['tunisie', 'tunisia', 'تونس']:
            raise serializers.ValidationError(
                "SmartShop livre uniquement en Tunisie. Pays invalide."
            )
        return 'Tunisie'

    def validate_postal_code(self, value):
        """Code postal tunisien = exactement 4 chiffres"""
        import re
        if not re.match(self.TUNISIAN_POSTAL_REGEX, str(value).strip()):
            raise serializers.ValidationError(
                "Le code postal tunisien doit contenir exactement 4 chiffres (ex: 1000)."
            )
        return value

    def validate_phone(self, value):
        """Numéro tunisien : +216 suivi de 8 chiffres, ou 8 chiffres directs"""
        import re
        clean = re.sub(r'[\s\-\.]', '', value)
        if re.match(r'^\+?216\d{8}$', clean) or re.match(r'^\d{8}$', clean):
            return value
        raise serializers.ValidationError(
            "Numéro de téléphone tunisien invalide. Format attendu : +216 XX XXX XXX ou 8 chiffres."
        )

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.CharField()

class CodeVerificationSerializer(serializers.Serializer):
    email = serializers.CharField()
    code = serializers.CharField()

class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.CharField()
    new_password = serializers.CharField()
    confirm_password = serializers.CharField()

    def validate(self, data):    
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError("Les mots de passe ne correspondent pas.")
        return data

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True, required=True)
    
    def validate(self, data):
        user = self.context['request'].user
        if not user.check_password(data['old_password']):
            raise serializers.ValidationError({
                'old_password': 'Mot de passe actuel incorrect.'
            })
 
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'Les mots de passe ne correspondent pas.'
            })
        
        if data['old_password'] == data['new_password']:
            raise serializers.ValidationError({
                'new_password': 'Le nouveau mot de passe doit être différent de l\'ancien.'
            })
        
        return data
    
    # def save(self, **kwargs):
    #     user = self.context['request'].user
    #     user.set_password(self.validated_data['new_password'])
    #     user.save()
    #     return user
