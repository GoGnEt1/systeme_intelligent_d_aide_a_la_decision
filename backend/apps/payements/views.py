"""
=============================================================
 apps/payements/views.py
 Endpoints dédiés au paiement — séparés des vues orders.
=============================================================
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404

from apps.orders.models import Order
from .models import Payment
from .serializers import PaymentSerializer


class PaymentDetailView(APIView):
    """
    GET  /api/payments/<order_id>/
    Lire le paiement d'une commande.
    Accessible par le propriétaire de la commande ou un admin.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, order_id):
        order   = get_object_or_404(Order, pk=order_id)
        # Vérifier que c'est bien la commande de cet utilisateur
        if order.user != request.user and not request.user.is_admin:
            return Response({'error': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        payment = get_object_or_404(Payment, order=order)
        return Response(PaymentSerializer(payment).data)


class PaymentAdminUpdateView(APIView):
    """
    PATCH /api/payments/<order_id>/
    Admin uniquement — mettre à jour le statut d'un paiement.
    Ex: marquer un paiement COD comme COMPLETED après livraison.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, order_id):
        if not request.user.is_admin:
            return Response({'error': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        order   = get_object_or_404(Order, pk=order_id)
        payment = get_object_or_404(Payment, order=order)

        new_status = request.data.get('status')
        valid_statuses = [s[0] for s in Payment.PayStatus.choices]

        if new_status not in valid_statuses:
            return Response(
                {'error': f'Statut invalide. Valeurs : {valid_statuses}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment.status = new_status
        if new_status == Payment.PayStatus.COMPLETED:
            payment.transaction_ref = request.data.get('transaction_ref') or payment.transaction_ref
        payment.save()

        return Response(PaymentSerializer(payment).data)
