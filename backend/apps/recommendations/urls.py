"""
backend/apps/recommendations/urls.py
"""
from django.urls import path
from .views import (
    PersonalizedRecommendationsView,
    TrendingView,
    SimilarProductsView,
    BoughtTogetherView,
)

urlpatterns = [
    path("",                PersonalizedRecommendationsView.as_view(), name="recommendations"),
    path("trending/",       TrendingView.as_view(),                    name="trending"),
    path("similar/",        SimilarProductsView.as_view(),             name="similar"),
    path("bought-together/", BoughtTogetherView.as_view(),             name="bought-together"),
]