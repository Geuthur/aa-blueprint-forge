"""App Configuration"""

# Django
from django.apps import AppConfig

# AA Blueprint Forge
from bpforge import __version__


class BlueprintForgeConfig(AppConfig):
    """App Config"""

    default_auto_field = "django.db.models.AutoField"
    name = "bpforge"
    label = "bpforge"
    verbose_name = f"Blueprint Forge v{__version__}"
