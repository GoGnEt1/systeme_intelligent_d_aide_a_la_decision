"""
=============================================================
 apps/users/views.py
 Vues API : Authentification + Gestion profil
=============================================================
"""
import random
from django.utils import timezone
from datetime import timedelta

from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction
from django.conf import settings

from .models import User, Address, PasswordResetCode
from .serializers import (
    RegisterSerializer, UserSerializer,
    CustomTokenObtainPairSerializer,
    AddressSerializer, ChangePasswordSerializer,
    CodeVerificationSerializer, ResetPasswordSerializer,
    PasswordResetRequestSerializer
)

from smartshop.utils.email_utils import send_html_email


def generate_code():
    return "{:06d}".format(random.randint(0, 999999))

def mask_email(email):
    email_name, domain_part = email.strip().rsplit("@", 1)
    masked_email = email_name[:3] + "*" * (len(email_name) - 3)

    return f'{masked_email}@{domain_part}'

class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/
    Inscription d'un nouvel utilisateur.
    Aucune authentification requise (permission AllowAny).
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Générer les tokens JWT directement après inscription
        refresh = RefreshToken.for_user(user)
        
        # ── Email de bienvenue (envoi asynchrone recommandé en prod) ──
        try:
            send_html_email(
                subject="Bienvenue sur SmartShop !",
                template="welcome.html",
                context={
                    "user": user,
                    "year": timezone.now().year,
                    "base_url": getattr(settings, 'FRONTEND_URL', 'http://localhost:5173/'),
                },
                recipient_list=user.email,
            )
        except Exception:
            pass  # L'inscription ne doit pas échouer si l'email échoue

        return Response({
            "message": "Inscription réussie !",
            "user": UserSerializer(user).data,
            "tokens": {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Body: { "email": "...", "password": "..." }
    Retourne: access token + refresh token + infos user
    """
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Invalide le refresh token (blacklist).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Déconnexion réussie."}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"error": "Token invalide."}, status=status.HTTP_400_BAD_REQUEST)

class RequestResetCodeView(APIView):
    """
    POST /api/auth/request-code/
    """
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "Utilisateur inexistant"})
        
        # vérification du nbre de tentatives consécutives (en 24h)
        recent_codes = PasswordResetCode.objects.filter(
            user=user,
            create_at__gte=timezone.now() - timedelta(hours=24)
        )

        if recent_codes.count() > 20:
            return Response({"error": "Trop de tentatives. Réessayer après 24h."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        
        # générer le code
        code = generate_code()
        pr_code = PasswordResetCode.objects.create(
            user=user,
            code=code
        )
        
        # calculer expire_at (timestamp en ms depuis epoch) basé sur settings
        expire_minutes = getattr(settings, "PASSWORD_RESET_CODE_EXPIRATION_MINUTES", 2.5)
        expire_delta = timedelta(minutes=float(expire_minutes))
        expire_at = pr_code.create_at + expire_delta

        # envoie une notificatons à l'utilisateur par email si email est renseigné
        masked_email = None
        to_mail = user.email or None
        if to_mail and '@' in str(to_mail):
            lien = settings.FRONTEND_URL + "verify-code"

            send_html_email(
                subject="Code de récupération",
                template="reset_password_code.html",
                context={
                    "user": user,
                    "code": code,
                    "year": timezone.now().year,
                    "lien_espace": lien,
                },
                recipient_list=to_mail,
            )
        
            masked_email = mask_email(to_mail)
        resp = {
            "message": f"Code envoyé à l'email {masked_email}",
            "expire_at": expire_at,
            "masked_email": masked_email
        }
        
        return Response(resp, status=status.HTTP_200_OK)
    
class VerifyCodeView(APIView):
    """
    POST /api/auth/verify-code/
    """
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request):
        serializer = CodeVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        code = serializer.validated_data['code']

        try:
            user = User.objects.get(email=email)
            last_code = PasswordResetCode.objects.filter(user=user, is_used=False).latest('create_at')
        except (User.DoesNotExist, PasswordResetCode.DoesNotExist):
            return Response({"error": "Utilisateur ou code inexistant"}, status=status.HTTP_404_NOT_FOUND)
        
        if last_code.attemps >= 3:
            return Response({"error": "Trop de tentative"}, status=status.HTTP_403_FORBIDDEN)
        
        if not last_code.is_valid():
            return Response({"error": "Code expiré. Recommencez."}, status=status.HTTP_403_FORBIDDEN)
        
        if last_code.code != code:
            last_code.attemps += 1
            last_code.save()
            return Response({"error": "Code incorrect"}, status=status.HTTP_400_BAD_REQUEST)
        
        last_code.is_used = True
        last_code.save()

        return Response({
            "message": "Code vérifié avec succès"
        }, status=status.HTTP_200_OK)

class ResetPasswordView(APIView):
    """
    POST /api/auth/reset-password/
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "Utilisateur inexistant"})
        
        user.set_password(serializer.validated_data['new_password'])
        user.save()

        # créer du tokens
        token = CustomTokenObtainPairSerializer.get_token(user=user)
        access = str(token.access_token)
        refresh_token = str(token)

        return Response({
            "message": "Mot de passe réinitialisé avec succès",
            "access": access,
            "refresh": refresh_token
        }, status=status.HTTP_200_OK)

class ProfileView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/auth/profile/  → lire son profil
    PUT  /api/auth/profile/  → modifier son profil
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({"message": "Mot de passe modifié avec succès."})


class AddressListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/auth/addresses/     → liste mes adresses
    POST /api/auth/addresses/     → ajouter une adresse
    """
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/DELETE /api/auth/addresses/<id>/
    """
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

class AdminStatsView(APIView):
    """
    GET /api/auth/admin-stats/
    Retourne des statistiques admin : nombre total de clients, nouveaux ce mois, etc.
    Accessible uniquement aux admins.
    """
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request):
        from django.utils import timezone
        from django.db.models import Count

        now = timezone.now()
        first_day = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        total_users = User.objects.filter(is_active=True).count()
        new_this_month = User.objects.filter(
            is_active=True, # is_staff=False,
            date_joined__gte=first_day
        ).count()

        return Response({
            'total_customers': total_users,
            'new_this_month': new_this_month,
        })

