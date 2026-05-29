"""
=============================================================
 apps/payements/serializers.py
=============================================================
"""
from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model  = Payment
        fields = [
            'id', 'method', 'method_display',
            'status', 'status_display',
            'amount',
            'idinar_number',   # affiché masqué côté front (···1234)
            'card_last4', 'card_brand',
            'transaction_ref',
            'created_at',
        ]
        read_only_fields = [
            'status', 'amount', 'transaction_ref', 'created_at',
        ]


class CreatePaymentSerializer(serializers.Serializer):
    """
    Sérialiseur de création — utilisé lors du POST /api/orders/
    Embarqué dans CreateOrderSerializer (apps.orders) qui l'importe.
    """
    payment_method = serializers.ChoiceField(
        choices=Payment.Method.choices,
        default=Payment.Method.COD
    )
    idinar_number = serializers.CharField(
        required=False, allow_blank=True, default=''
    )

    def validate(self, data):
        if data.get('payment_method') == Payment.Method.MOBILE:
            idinar = data.get('idinar_number', '').strip()
            if not idinar or len(idinar) != 17 or not idinar.isdigit():
                raise serializers.ValidationError({
                    'idinar_number': 'Le numéro i-Dinar doit contenir exactement 17 chiffres.'
                })
        return data
