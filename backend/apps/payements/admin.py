from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display  = ['order', 'method', 'status', 'amount', 'created_at']
    list_filter   = ['method', 'status']
    search_fields = ['order__order_number', 'transaction_ref', 'idinar_number']
    readonly_fields = ['created_at', 'updated_at']
    ordering      = ['-created_at']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('order__user')
