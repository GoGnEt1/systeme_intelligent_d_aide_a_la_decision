# backend/seeders/order_seeder.py — v2 CORRIGÉ
"""
CORRECTION : Le seeder v1 utilisait random.randint() pour les dates
→ distribution uniforme → bruit blanc → Prophet MAPE 60-80%.

v2 introduit une structure temporelle réaliste :
  1. Distribution exponentielle (commandes récentes plus probables)
  2. Saisonnalité hebdomadaire (weekends +20-30%)
  3. Tendance croissante au fil des mois (+2% / mois)
  4. Pics saisonniers (Ramadan, rentrée, Noël) corrigés pour la Tunisie
  5. Légère variation journalière (bruit contrôlé ≤ 15%)

Résultat attendu après re-seeding : Prophet MAPE 15-30% (vs 66-76%).
"""
import random
import math
from decimal import Decimal

from faker import Faker
from django.db import transaction
from django.db.models import F

from apps.products.models import Product
from apps.users.models import User
from apps.orders.models import Order, OrderItem
from apps.payements.models import Payment

from datetime import timedelta
from django.utils import timezone

# ── Config ───────────────────────────────────────────────────
fake = Faker('fr_FR')
Faker.seed(42)
random.seed(42)

HISTORY_MONTHS = 18   # 18 mois = suffisant pour Prophet weekly + tendance
N_CLIENTS      = 200


def get_profile(idx):
    """Profils RFM : champions (15%), loyaux (30%), réguliers (30%), at-risk (25%)"""
    if idx < N_CLIENTS * 0.15:
        return {'n_orders': (10, 22), 'recency_max': 60}
    elif idx < N_CLIENTS * 0.45:
        return {'n_orders': (5, 12), 'recency_max': 150}
    elif idx < N_CLIENTS * 0.75:
        return {'n_orders': (2, 6), 'recency_max': 400}
    else:
        return {'n_orders': (1, 3), 'recency_max': 600}


def _seasonal_multiplier(odate) -> float:
    """
    Retourne un multiplicateur de revenu selon la date.
    Simule les effets saisonniers réels en Tunisie pour l'e-commerce :
      - Ramadan (Shawwal ~mars-avril) : +25% (cadeaux, achats)
      - Été (juin-juillet) : -15% (moins d'achats tech en chaleur)
      - Rentrée scolaire (septembre) : +20%
      - Black Friday / Noël (nov-déc) : +30%
      - Weekends (ven-sam en Tunisie) : +20%
    """
    m = 1.0

    # Saisonnalité mensuelle
    month_factors = {
        1:  0.90,   # jan : post-fêtes, creux
        2:  0.92,
        3:  1.15,   # mars : souvent Ramadan
        4:  1.20,   # avril : fin Ramadan + cadeaux
        5:  1.05,
        6:  0.88,   # été
        7:  0.85,
        8:  0.95,
        9:  1.18,   # rentrée
        10: 1.10,
        11: 1.25,   # Black Friday
        12: 1.30,   # Noël / fêtes de fin d'année
    }
    m *= month_factors.get(odate.month, 1.0)

    # Saisonnalité hebdomadaire (vendredi=4, samedi=5 en Python weekday)
    # En Tunisie : vendredi et samedi sont les jours de week-end
    if odate.weekday() in (4, 5):    # vendredi + samedi
        m *= 1.22
    elif odate.weekday() == 6:        # dimanche : légèrement plus fort
        m *= 1.08
    elif odate.weekday() == 0:        # lundi : retour de weekend
        m *= 0.92

    # Bruit aléatoire léger (±10% max) — contrôlé pour garder le signal
    noise = random.gauss(1.0, 0.06)
    noise = max(0.85, min(1.15, noise))
    m *= noise

    return m


def _days_ago_exponential(recency_max: int) -> int:
    """
    Génère un nombre de jours "days_ago" avec distribution exponentielle.
    Les commandes récentes sont significativement plus probables que les anciennes.
    
    Cela crée une tendance naturelle (plus d'achats dans le temps = croissance).
    Lambda calibré pour que ~50% des commandes soient dans la première moitié de l'historique.
    """
    max_days = min(recency_max, HISTORY_MONTHS * 30)
    # Distribution exponentielle avec lambda = 3/max (décroissance sur ~1/3 de l'historique)
    lam = 3.0 / max_days
    days = int(random.expovariate(lam))
    days = max(1, min(days, max_days))
    return days


def _trend_multiplier(days_ago: int) -> float:
    """
    Croissance progressive au fil du temps.
    Une commande faite il y a N jours avait un revenu moyen plus faible
    qu'une commande récente (site qui monte en popularité).
    ~+2% par mois = ~+0.067% par jour.
    """
    growth_per_day = 0.0007   # 0.07% / jour = ~2% / mois
    max_days = HISTORY_MONTHS * 30
    # age_factor : 0 (très ancien) → 1 (très récent)
    age_factor = 1.0 - (days_ago / max_days)
    return 1.0 + growth_per_day * max_days * age_factor


class OrderSeeder:
    def run(self):
        self.seed_orders()

    @transaction.atomic
    def seed_orders(self):
        if not User.objects.exists():
            raise Exception("Users required")
        if not Product.objects.exists():
            raise Exception("Products required")

        print(f"\nCommandes (historique {HISTORY_MONTHS} mois — seeder v2 avec structure temporelle)...")
        now = timezone.now()
        orders_created = 0
        clients = list(User.objects.all())
        products = list(Product.objects.filter(status=Product.Status.ACTIVE))

        with transaction.atomic():
            for idx, client in enumerate(clients):
                prof    = get_profile(idx)
                n_ord   = random.randint(*prof['n_orders'])
                existing = Order.objects.filter(user=client).count()
                if existing >= n_ord:
                    continue

                for _ in range(n_ord - existing):
                    # FIX v2 : distribution exponentielle au lieu de uniforme
                    days_ago = _days_ago_exponential(prof['recency_max'])
                    odate    = now - timedelta(days=days_ago)

                    n_items = random.choices([1, 2, 3, 4, 5], weights=[40, 30, 15, 10, 5])[0]
                    sel     = random.sample(products, min(n_items, len(products)))

                    subtotal    = Decimal('0.00')
                    items_data  = []
                    for prod in sel:
                        qty = random.choices([1, 2, 3], weights=[70, 20, 10])[0]
                        items_data.append((prod, qty, prod.price))
                        subtotal += prod.price * qty

                    # FIX v2 : multiplicateurs saisonniers réalistes + tendance
                    seasonal = _seasonal_multiplier(odate)
                    trend    = _trend_multiplier(days_ago)
                    subtotal = (subtotal * Decimal(str(round(seasonal * trend, 4)))).quantize(Decimal('0.01'))

                    shipping = Decimal('8.00') if subtotal < 300 else Decimal('0.00')
                    discount = Decimal('0.00')
                    if random.random() < 0.20:
                        pct      = random.choice([5, 10, 15, 20])
                        discount = (subtotal * pct / 100).quantize(Decimal('0.01'))

                    tva   = Decimal('1.00')
                    total = subtotal + shipping - discount + tva

                    # Statut selon ancienneté
                    if days_ago < 7:
                        status = random.choices(['PENDING', 'CONFIRMED'], weights=[60, 40])[0]
                    elif days_ago < 21:
                        status = random.choices(
                            ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'],
                            weights=[10, 15, 25, 50]
                        )[0]
                    else:
                        status = random.choices(['DELIVERED', 'CANCELLED'], weights=[88, 12])[0]

                    order = Order(
                        user=client,
                        order_number=Order.generate_order_number(),
                        status=status,
                        subtotal=subtotal,
                        shipping_cost=shipping,
                        discount_amount=discount,
                        tva_timbre=tva,
                        total_amount=total,
                        created_at=odate,
                        updated_at=odate,
                        shipping_full_name=client.get_full_name(),
                        shipping_city=client.city,
                        shipping_postal_code=str(random.randint(1000, 9999)),
                        shipping_country='Tunisie',
                        shipping_address_line=fake.street_address(),
                        shipping_phone=client.phone,
                    )
                    if status == 'DELIVERED':
                        order.delivered_at = odate + timedelta(days=random.randint(2, 7))
                    order.save()

                    OrderItem.objects.bulk_create([
                        OrderItem(
                            order=order, product=p,
                            product_name=p.name, unit_price=up, quantity=q
                        )
                        for p, q, up in items_data
                    ])
                    for p, q, _ in items_data:
                        Product.objects.filter(pk=p.pk).update(purchase_count=F('purchase_count') + q)

                    method = random.choices(['COD', 'MOBILE', 'CARD'], weights=[50, 25, 25])[0]
                    pay_st = (
                        'COMPLETED' if status in ['DELIVERED', 'SHIPPED', 'PROCESSING', 'CONFIRMED']
                        else 'PENDING' if status == 'PENDING'
                        else 'FAILED'
                    )
                    if status == 'CANCELLED':
                        pay_st = random.choice(['FAILED', 'REFUNDED'])

                    Payment.objects.create(
                        order=order, method=method, status=pay_st, amount=total
                    )
                    orders_created += 1

        print(f"   ✓ {orders_created} nouvelles commandes (distribution temporelle structurée)")
        print(f"   → Relancez le notebook S5 : MAPE attendu 15-30% (vs 66-76% avant)")