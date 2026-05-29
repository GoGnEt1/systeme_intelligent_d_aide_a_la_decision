"""apps/users/urls.py"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # ── Auth ────────────────────────────────────────────────
    path('admin-stats/',     views.AdminStatsView.as_view(),     name='admin_stats'),
    path('register/',        views.RegisterView.as_view(),       name='register'),
    path('login/',           views.LoginView.as_view(),          name='login'),
    path('logout/',          views.LogoutView.as_view(),         name='logout'),
    path('token/refresh/',   TokenRefreshView.as_view(),         name='token_refresh'),

    # phone
    # path('phone-login/',  views.PhoneLoginRequestView.as_view(),  name='phone_login'),
    # path('phone-verify/', views.PhoneLoginVerifyView.as_view(),   name='phone_verify'),

    path('request-code/', views.RequestResetCodeView.as_view(), name='request_code'),
    path('verify-code/', views.VerifyCodeView.as_view(), name='verify_code_2f'),
    path('reset-password/', views.ResetPasswordView.as_view(), name='reset_password'),

    # ── Profil ──────────────────────────────────────────────
    path('profile/',         views.ProfileView.as_view(),        name='profile'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change_password'),

    # ── Adresses ────────────────────────────────────────────
    path('addresses/',       views.AddressListCreateView.as_view(),   name='address_list'),
    path('addresses/<int:pk>/', views.AddressDetailView.as_view(),    name='address_detail'),
]
