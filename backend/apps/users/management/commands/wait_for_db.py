"""
apps/users/management/commands/wait_for_db.py

Commande custom Django : attend que PostgreSQL soit prêt.
Sans ça, Django démarre avant que la DB soit disponible → erreur.

USAGE dans docker-compose :
  command: sh -c "python manage.py wait_for_db && python manage.py migrate && ..."
"""

import time
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError


class Command(BaseCommand):
    help = "Attend que la base de données PostgreSQL soit disponible"

    def handle(self, *args, **options):
        self.stdout.write("⏳ En attente de la base de données...")
        db_conn = None
        attempts = 0
        
        while not db_conn:
            try:
                db_conn = connections['default']
                db_conn.ensure_connection()
                self.stdout.write(self.style.SUCCESS("✅ Base de données disponible !"))
            except OperationalError:
                attempts += 1
                self.stdout.write(f"   Tentative {attempts} — DB non disponible, attente 1s...")
                time.sleep(1)
                
                if attempts > 30:
                    self.stdout.write(self.style.ERROR("❌ Impossible de se connecter à la DB après 30 tentatives."))
                    raise
