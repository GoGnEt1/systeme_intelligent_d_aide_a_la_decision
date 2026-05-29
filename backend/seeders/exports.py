# /backend/seeders/exports.py
# backend/seeders/export_seeder.py

import csv
import os
from pathlib import Path

from apps.orders.models import Order, OrderItem
from apps.users.models import User
from apps.products.models import Category, Product, Review
from apps.analytics.models import CustomerSegment


class ExportSeeder:

    def run(self):

        print("\nExport des données ML...")

        output_dir = (
            Path(
                os.getenv(
                    'ML_DATA_DIR',
                    '/shared/ml_data'
                )
            ) / 'smartshop_real'
        )

        output_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        self.export_orders(output_dir)
        self.export_reviews(output_dir)
        self.export_rfm(output_dir)
        self.export_products(output_dir)
        self.export_order_items(output_dir)

        print(f"\nCSV exportés dans : {output_dir}")

        self.summaries()

    def export_orders(self, output_dir):

        print("→ Export orders.csv")

        with open(
            output_dir / 'orders.csv',
            'w',
            newline='',
            encoding='utf-8'
        ) as f:

            writer = csv.writer(f)

            writer.writerow([
                'order_id',
                'user_id',
                'date',
                'total_amount',
                'status',
                'shipping_cost',
                'discount_amount',
                'n_items',
            ])

            for order in Order.objects.filter(
                status='DELIVERED'
            ).select_related('user'):

                writer.writerow([
                    order.pk,
                    order.user.pk,
                    order.created_at.strftime('%Y-%m-%d'),
                    float(order.total_amount),
                    order.status,
                    float(order.shipping_cost),
                    float(order.discount_amount),
                    order.items.count(),
                ])

    def export_reviews(self, output_dir):
        print("→ Export reviews.csv")

        with open(
            output_dir / 'reviews.csv',
            'w',
            newline='',
            encoding='utf-8'
        ) as f:

            writer = csv.writer(f)

            writer.writerow([
                'user_id',
                'product_id',
                'rating',
                'created_at'
            ])

            for review in Review.objects.select_related('user', 'product').all():

                writer.writerow([
                    review.user.pk,
                    review.product.pk,
                    review.rating,
                    review.created_at.strftime('%Y-%m-%d'),
                ])

    def export_rfm(self, output_dir):
        print("→ Export rfm.csv")

        with open(
            output_dir / 'rfm.csv',
            'w',
            newline='',
            encoding='utf-8'
        ) as f:

            writer = csv.writer(f)

            writer.writerow([
                'user_id',
                'email',
                'recency_days',
                'frequency',
                'monetary',
                'avg_order_value',
                'segment'
            ])
            
            for seg in CustomerSegment.objects.select_related('user').all():
                writer.writerow([
                    seg.user.pk,
                    seg.user.email,
                    seg.recency_days,
                    seg.frequency,
                    float(seg.monetary),
                    float(seg.avg_order_value or 0),
                    seg.segment,
                ])


    def export_products(self, output_dir):
        print("→ Export products.csv")

        with open(
            output_dir / 'products.csv',
            'w',
            newline='',
            encoding='utf-8'
        ) as f:

            writer = csv.writer(f)

            writer.writerow([
                'product_id',
                'name',
                'description',
                'category',
                'price',
                'view_count',
                'purchase_count',
                'avg_rating'
            ])

            for prod in Product.objects.select_related('category').filter(status='ACTIVE'):

                writer.writerow([
                    prod.pk,
                    prod.name,
                    prod.description,
                    prod.category.name,
                    float(prod.price),
                    prod.view_count,
                    prod.purchase_count,
                    prod.average_rating,
                ])

    def export_order_items(self, output_dir):
        print("→ Export order_items.csv")

        with open(
            output_dir / 'order_items.csv',
            'w',
            newline='',
            encoding='utf-8'
        ) as f:

            writer = csv.writer(f)

            writer.writerow([
                'user_id',
                'product_id',
                'quantity',
                'unit_price',
                'order_date',
                'order_status'
            ])

            for item in OrderItem.objects.select_related('order__user', 'product').all():
                writer.writerow([
                    item.order.user.pk,
                    item.product.pk,
                    item.quantity,
                    float(item.unit_price),
                    item.order.created_at.strftime('%Y-%m-%d'),
                    item.order.status,
                ])


    def summaries(self):
        # ─────────────────────────────────────────────────────────────
        # RÉSUMÉ FINAL
        # ─────────────────────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("   RÉSUMÉ DU SEEDING")
        print("=" * 60)
        print(f"   Catégories  : {Category.objects.count()}")
        print(f"   Produits    : {Product.objects.count()}")
        print(f"   Clients     : {User.objects.filter(role='CLIENT').count()}")
        print(f"   Commandes   : {Order.objects.count()}")
        print(f"     → Livrées  : {Order.objects.filter(status='DELIVERED').count()}")
        print(f"     → Annulées : {Order.objects.filter(status='CANCELLED').count()}")
        print(f"   Avis        : {Review.objects.count()}")
        print(f"   Segments RFM: {CustomerSegment.objects.count()}")
        print(f"     → Champions: {CustomerSegment.objects.filter(segment='champions').count()}")
        print(f"     → Loyaux   : {CustomerSegment.objects.filter(segment='loyaux').count()}")
        print(f"     → À risque : {CustomerSegment.objects.filter(segment='a_risque_perdus').count()}")
        print("=" * 60)

