from django.urls import path
from . import views

urlpatterns = [
    # GET  : lire le paiement d'une commande (client ou admin)
    # PATCH: mettre à jour le statut (admin uniquement)
    path('<int:order_id>/', views.PaymentDetailView.as_view(),      name='payment_detail'),
    path('<int:order_id>/update/', views.PaymentAdminUpdateView.as_view(), name='payment_update'),
]