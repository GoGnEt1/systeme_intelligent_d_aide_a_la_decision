# backend/seeders/review_seeder.py
import random
from datetime import timedelta
from django.db import transaction

from apps.orders.models import Order, OrderItem
from apps.products.models import Review
from faker import Faker

# ── Config ───────────────────────────────────────────────────
fake = Faker('fr_FR')          # locale française (noms, adresses)
Faker.seed(42)                 # reproductibilité
random.seed(42)

from seeders.data import REVIEW_COMMENTS
REVIEW_RATE      = 0.50        # % de commandes livrées qui génèrent un avis

class ReviewSeeder:

    def run(self):

        self.seed_reviews()
    
    @transaction.atomic
    def seed_reviews(self):
        reviews_created = 0
        reviewed_pairs = set()
        reviews_bulk=[]

        delivered_orders = Order.objects.filter(status='DELIVERED').select_related('user')
        for order in delivered_orders:
            if random.random()>REVIEW_RATE: continue
            for item in OrderItem.objects.filter(order=order).select_related('product'):
                if Review.objects.filter(user=order.user,product=item.product).exists(): continue
                rating=random.choices([1,2,3,4,5],weights=[3,5,10,30,52])[0]
                reviews_bulk.append(Review(
                    user=order.user,product=item.product,rating=rating,
                    comment=random.choice(REVIEW_COMMENTS[rating]),
                    title=random.choice([
                        "Excellent produit",
                        "Très satisfait",
                        "Bon rapport qualité/prix",
                        "Je recommande",
                        "Déçu par le produit"
                    ]),
                    is_verified_purchase=True,
                    created_at=order.created_at+timedelta(days=random.randint(1,14)),
                ))
        created_r=0
        for i in range(0,len(reviews_bulk),500):
            Review.objects.bulk_create(reviews_bulk[i:i+500],ignore_conflicts=True)
            created_r+=len(reviews_bulk[i:i+500])
        print(f"   ✓ {created_r} avis créés")
