# backend/apps/recommendations/management/commands/export_interactions.py
import pandas as pd
from django.core.management.base import BaseCommand

from apps.orders.models import OrderItem
from apps.products.models import Review


class Command(BaseCommand):
    help = "Exporter les interactions utilisateurs-produits"

    def handle(self, *args, **options):

        rows = []

        # Interactions implicites (achats)
        for oi in OrderItem.objects.select_related(
            'order',
            'product'
        ):

            if oi.order.status in ['DELIVERED', 'SHIPPED', 'CONFIRMED']:
                # catégorie et desc du prod
                category = oi.product.category.name
                description = oi.product.description
                
                rows.append({
                    'UserId': str(oi.order.user_id),
                    'ProductId': str(oi.product_id),
                    'Rating': 5 if oi.quantity >= 2 else 4,
                    'source': 'purchase',
                    'Category': category,
                    'Description': description
                })

        # Avis explicites
        for r in Review.objects.select_related(
            'user',
            'product'
        ).all():
            
            category = r.product.category.name
            description = r.product.description

            rows.append({
                'UserId': str(r.user_id),
                'ProductId': str(r.product_id),
                'Rating': r.rating,
                'source': 'review',
                'Category': category,
                'Description': description
            })

        df = pd.DataFrame(rows).drop_duplicates(
            ['UserId', 'ProductId'],
            keep='last'
        )

        output_path = "/shared/ml_data/smartshop_interactions.csv"

        df.to_csv(output_path, index=False)

        self.stdout.write(
            self.style.SUCCESS(
                f"Exporté {len(df)} interactions vers {output_path}"
            )
        )