# backend/seeders/rfm_seeder.py
import random
from decimal import Decimal
from django.db import transaction

from django.utils import timezone
from apps.orders.models import Order
from apps.users.models import User
from apps.analytics.models import CustomerSegment

from faker import Faker

# ── Config ───────────────────────────────────────────────────
fake = Faker('fr_FR')          # locale française (noms, adresses)
Faker.seed(42)                 # reproductibilité
random.seed(42)

class RFMSeeder:

    def run(self):

        self.seed_rfm()
    
    @transaction.atomic
    def seed_rfm(self):
        """
        Calcule R/F/M pour chaque client depuis les vraies commandes
        et upsert dans analytics_customersegment.
        """
        print("\n[RFM] Calcul des segments RFM...")
 
        now = timezone.now()
        clients = User.objects.filter(role='CLIENT', is_active=True)
        created = 0
 
        for client in clients:
            orders = Order.objects.filter(
                user=client,
                status__in=['DELIVERED', 'SHIPPED', 'CONFIRMED']
            ).order_by('-created_at')
 
            if not orders.exists():
                continue
 
            # ── Calcul R/F/M ──────────────────────────────────────
            last_order_date = orders.first().created_at
            recency         = (now - last_order_date).days
            frequency       = orders.count()
            monetary        = float(sum(o.total_amount for o in orders))
            avg_order       = monetary / frequency if frequency else 0
 
            # ── Segmentation heuristique initiale ─────────────────
            # (sera remplacée par K-Means du notebook S4)
            if recency <= 60 and frequency >= 8 and monetary >= 1500:
                seg, label, cid = 'champions', '🏆 Champions', 0
            elif recency <= 150 and frequency >= 4:
                seg, label, cid = 'loyaux', '💙 Loyaux', 1
            else:
                seg, label, cid = 'a_risque_perdus', '⚠️ À risque / Perdus', 2
 
            CustomerSegment.objects.update_or_create(
                user=client,
                defaults={
                    'recency_days':    recency,
                    'frequency':       frequency,
                    'monetary':        Decimal(str(round(monetary, 3))),
                    'avg_order_value': Decimal(str(round(avg_order, 3))),
                    'cluster_id':      cid,
                    'segment':         seg,
                    'segment_label':   label,
                    'computed_at':     now,
                    'model_version':   'heuristic_v1',
                }
            )
            created += 1

        print(f"   ✓ {created} segments calculés")


"""
        for client in clients:
            client_orders = Order.objects.filter(
                user=client,
                status__in=['DELIVERED', 'SHIPPED', 'PROCESSING', 'CONFIRMED']
            )

            if not client_orders.exists():
                continue

            # Calcul RFM
            agg = client_orders.aggregate(
                frequency=Count('id'),
                monetary=Sum('total_amount'),
                last_order=Max('created_at'),
            )

            recency_days = (reference_date - agg['last_order']).days
            frequency    = agg['frequency'] or 0
            monetary     = float(agg['monetary'] or 0)
            avg_order    = monetary / frequency if frequency > 0 else 0

            # Segmentation simplifiée (sera affinée par K-Means)
            if recency_days <= 60 and frequency >= 5 and monetary >= 1000:
                segment = 'champions'
                segment_label = 'Client champion — acheteur fidèle et récent'
            elif frequency >= 3 and monetary >= 400:
                segment = 'loyaux'
                segment_label = 'Client loyal — acheteur régulier'
            else:
                segment = 'a_risque_perdus'
                segment_label = 'Client à risque — activité faible ou ancienne'

            CustomerSegment.objects.update_or_create(
                user=client,
                defaults={
                    'recency_days': recency_days,
                    'frequency': frequency,
                    'monetary': Decimal(str(round(monetary, 3))),
                    'avg_order_value': Decimal(str(round(avg_order, 3))),
                    'cluster_id': 0,  # sera mis à jour par K-Means
                    'segment': segment,
                    'segment_label': segment_label,
                    'computed_at': reference_date,
                }
            )

            # Mettre à jour le champ rfm_segment sur le User
            User.objects.filter(pk=client.pk).update(rfm_segment=segment)
            segments_created += 1

        print(f"{segments_created} segments RFM crées.")
"""
