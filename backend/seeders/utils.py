# backend/seeders/utils.py
import random
import string
from datetime import timedelta
from uuid import uuid4
from django.utils.text import slugify
from django.utils import timezone

def generate_unique_slug(model, name):
    """
    Génère un slug unique pour éviter les collisions.
    """

    return slugify(name)[:180]



def random_tunisian_phone():
    """Génère un numéro tunisien réaliste (+216 XX XXX XXX)"""
    prefixes = ['20', '21', '22', '23', '24', '25', '26', '27',
                '50', '51', '52', '53', '54', '55', '56', '57',
                '90', '91', '92', '93', '94', '95', '96', '97', '98', '99']
    prefix = random.choice(prefixes)
    return f"+216 {prefix} {''.join(random.choices(string.digits, k=3))} {''.join(random.choices(string.digits, k=3))}"


def random_past_datetime(months_back=24):
    """Date aléatoire dans les N derniers mois, avec saisonnalité"""
    now = timezone.now()
    days_back = random.randint(1, months_back * 30)
    dt = now - timedelta(days=days_back)
    # Saisonnalité : plus d'achats en novembre-décembre et juillet-août
    month = dt.month
    if month in [11, 12]:
        if random.random() < 0.3:  # 30% chance de redoubler
            dt = now - timedelta(days=random.randint(1, 60))
    elif month in [7, 8]:
        if random.random() < 0.2:
            dt = now - timedelta(days=random.randint(180, 300))
    return dt


def generate_sku(product_name, idx):
    """Génère un SKU unique"""
    prefix = ''.join(c for c in product_name[:3].upper() if c.isalpha())
    return f"SS-{prefix}-{idx:04d}"

