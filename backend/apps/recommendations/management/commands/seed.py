from django.core.management.base import BaseCommand

from seeders.category_product_seeder import CategoryProductSeeder
from seeders.user_seeder import UserSeeder
from seeders.order_seeder import OrderSeeder
from seeders.review_seeder import ReviewSeeder
from seeders.rfm_seeder import RFMSeeder
from seeders.exports import ExportSeeder

class Command(BaseCommand):

    help = "Seed SmartShop database"

    def add_arguments(self, parser):

        parser.add_argument(
            "--products",
            action="store_true"
        )

        parser.add_argument(
            "--users",
            action="store_true"
        )

        parser.add_argument(
            "--orders",
            action="store_true"
        )

        parser.add_argument(
            "--reviews",
            action="store_true"
        )

        parser.add_argument(
            "--rfm",
            action="store_true"
        )

        parser.add_argument(
            "--all",
            action="store_true"
        )

        parser.add_argument(
            "--export",
            action="store_true"
        )

    def handle(self, *args, **options):

        if options["products"] or options["all"]:
            CategoryProductSeeder().run()

        if options["users"] or options["all"]:
            UserSeeder().run()

        if options["orders"] or options["all"]:
            OrderSeeder().run()

        if options["reviews"] or options["all"]:
            ReviewSeeder().run()

        if options["rfm"] or options["all"]:
            RFMSeeder().run()

        if options["export"] or options["all"]:
            ExportSeeder().run()

        self.stdout.write(
            self.style.SUCCESS("Seeding completed.")
        )