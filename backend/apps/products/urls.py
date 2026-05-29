"""apps/products/urls.py"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ProductViewSet, ProductImageViewSet, ProductImageDirectView

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'', ProductViewSet, basename='product')

images_router = DefaultRouter()
images_router.register(
    r'(?P<product_slug>[^/.]+)/images',
    ProductImageViewSet,
    basename='product-image'
)

urlpatterns = [
    path('', include(router.urls)),
    path('', include(images_router.urls)),
    # Suppression directe par ID sans slug produit (utilisé par le frontend admin)
    path('images/<int:pk>/', ProductImageDirectView.as_view(), name='product-image-direct'),
]
