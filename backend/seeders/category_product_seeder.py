# backend/seeders/category_product_seeder.py
import random
from decimal import Decimal

from faker import Faker
from django.db import transaction

from apps.products.models import Category, Product
from django.utils.text import slugify
from seeders.utils import generate_unique_slug, generate_sku
from seeders.data import CATEGORIES_DATA, PRODUCTS_DATA
# ── Config ───────────────────────────────────────────────────
random.seed(42)

# ─────────────────────────────────────────────────────────────
# ÉTAPE 1 : Catégories et Produits
# ─────────────────────────────────────────────────────────────

class CategoryProductSeeder:

    def run(self):

        self.seed_categories()

        self.seed_products()

    @transaction.atomic
    def seed_categories(self):
        print("Seeding categories...")

        for parent_order, (parent_name, children) in enumerate(
                    CATEGORIES_DATA.items()
                ):
            parent_cat, _ = Category.objects.get_or_create(
                name=parent_name,
                defaults={
                    "slug":  generate_unique_slug(
                    Category,
                    parent_name
                    ),
                    "description": f"SmartShop {parent_name}",
                    "is_active": True,
                    "order": parent_order,
                }
            )

            for child_order, child in enumerate(children, start=4):

                Category.objects.update_or_create(
                    name=child,
                    defaults={
                        "slug": generate_unique_slug(
                            Category,
                            child
                        ),
                        "description": f"Catégorie {child} — SmartShop",
                        "parent": parent_cat,
                        "is_active": True,
                        'order': child_order,
                    }
                )


        print(f"Categories seeded ({Category.objects.count()})")
        
    @transaction.atomic
    def seed_products(self):
        print("\nSeeding products...")

        product_idx = 1

        for category_name, products in PRODUCTS_DATA.items():

            category = Category.objects.get(name=category_name)

            for item in products:

                sku = generate_sku(item["name"], product_idx)

                Product.objects.update_or_create(
                    sku=sku,

                    defaults={
                        "name": item["name"],

                        "slug": generate_unique_slug(
                            Product,
                            item["name"]
                        ),

                        "description": item["description"],

                        "category": category,

                        "price": Decimal(str(item["price"])),

                        "original_price": Decimal(
                            str(item["original_price"])
                        ),

                        "stock_quantity": item["stock"],

                        "view_count": random.randint(500, 50000),

                        "purchase_count": random.randint(10, 3000),

                        "status": "ACTIVE",

                        "is_featured": item.get(
                            "featured",
                            False
                        ),
                    }
                )

                product_idx += 1

        print(f"Products seeded ({Product.objects.count()})")