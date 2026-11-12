# Django
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("bpforge", "0007_order_history"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="general",
            options={
                "default_permissions": (),
                "managed": False,
                "permissions": (
                    ("basic_access", "Can access this app"),
                    ("manage_access", "Can manage"),
                    ("full_access", "Full access"),
                ),
                "verbose_name": "AA-Blueprint-Forge",
                "verbose_name_plural": "AA-Blueprint-Forge",
            },
        ),
    ]
