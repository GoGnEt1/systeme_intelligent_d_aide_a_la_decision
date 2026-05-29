"""apps/orders/urls.py"""
from django.urls import path, re_path
from . import views

urlpatterns = [
    # ── Panier ──────────────────────────────────────────────
    path('cart/',                    views.CartView.as_view(),            name='cart'),
    path('cart/items/',              views.CartItemView.as_view(),         name='cart_items'),
    path('cart/items/<int:pk>/',     views.CartItemDetailView.as_view(),   name='cart_item_detail'),
    path('cart/clear/',              views.CartClearView.as_view(),        name='cart_clear'),

    # ── Commandes ────────────────────────────────────────────
    path('',                         views.OrderListCreateView.as_view(),  name='order_list'),
    path('<int:pk>/',                views.OrderDetailView.as_view(),      name='order_detail'),
    path('<int:pk>/status/',         views.OrderStatusUpdateView.as_view(), name='order_status'),
    path('<int:pk>/cancel/',     views.OrderCancelView.as_view(),      name='order_cancel'),
    # re_path(r'^$',              views.OrderListCreateView.as_view(),    name='order_list'),

    # Livraison
    path('<int:pk>/missed-delivery/', views.OrderMissedDeliveryView.as_view(),  name='missed_delivery'),
    path('<int:pk>/delivery-date/',   views.OrderDeliveryDateView.as_view(),    name='delivery_date'),
]

"""
urlpatterns = [
    path('cart/',                  views.CartView.as_view(),           name='cart'),
    path('cart/items/',            views.CartItemView.as_view(),        name='cart_items'),
    path('cart/items/<int:pk>/',   views.CartItemDetailView.as_view(),  name='cart_item_detail'),
    path('cart/clear/',            views.CartClearView.as_view(),       name='cart_clear'),
    path('',                       views.OrderListCreateView.as_view(), name='order_list'),
    path('<int:pk>/',              views.OrderDetailView.as_view(),     name='order_detail'),
]
"""