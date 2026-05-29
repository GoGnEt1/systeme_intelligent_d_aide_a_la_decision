# backend/seeders/user_seeder.py
from apps.users.models import User, Address
from faker import Faker
from django.db import transaction
import random

from seeders.utils import random_tunisian_phone
from seeders.data import TUNISIAN_CITIES

# ── Config ───────────────────────────────────────────────────
fake = Faker('fr_FR')          # locale française (noms, adresses)
Faker.seed(42)                 # reproductibilité
random.seed(42)

# Paramètres de volume (ajustables)
N_CLIENTS        = 200         # nombre de clients à générer
class UserSeeder:
    def run(self):

        self.seed_users()
    @transaction.atomic
    def seed_users(self):
        print(f"\nCréation de {N_CLIENTS} clients...")

        for i in range(N_CLIENTS):
            # Éviter les doublons si le script est relancé
            email = f"client{i}@smartshop.tn"

            if User.objects.filter(email=email).exists():
                continue

            user = User.objects.create_user(
                email=email,
                password='SmartShop2024!',
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                phone=random_tunisian_phone(),
                role=User.Role.CLIENT,
                city=random.choice(TUNISIAN_CITIES),
                is_active=True,
            )

            # Adresse principale
            Address.objects.create(
                user=user,
                label='Domicile',
                full_name=user.get_full_name(),
                phone=user.phone,
                address_line=fake.street_address(),
                city=user.city,
                postal_code=str(random.randint(1000, 9999)),
                country='Tunisie',
                is_default=True,
            )

        
        print(f"Clients seeded ({User.objects.count()})")

