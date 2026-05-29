"""
backend/apps/analytics/urls.py
URL patterns pour l'application analytics (Sprint S4)
"""
from django.urls import path
from . import views

app_name = "analytics"

urlpatterns = [
    # ── Segmentation ──────────────────────────────────────────────────────────
    path("customers/",                  views.CustomerListView.as_view(),    name="customers"),
    path("segments-stats/",             views.SegmentsStatsView.as_view(),    name="segments-stats"),
    path("site-stats/",                 views.SiteStatsView.as_view(),        name="site-stats"),
    path("customers/<str:user_id>/segment/",
                                        views.CustomerSegmentView.as_view(), name="customer-segment"),
    path("resegment/",                  views.ResegmentView.as_view(),       name="resegment"),

    # path("auto-resegment/",              views.AutoResegmentView.as_view(),    name="auto-resegment"),


    # ── Offres cadeaux ────────────────────────────────────────────────────────
    path("gifts/",                      views.GiftOfferCreateView.as_view(), name="gifts-create"),
    path("gifts/<str:token>/",          views.GiftOfferDetailView.as_view(), name="gift-detail"),
    path("gifts/<str:token>/respond/",  views.GiftOfferRespondView.as_view(),name="gift-respond"),
]