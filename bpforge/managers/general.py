"""Permission rules of the app."""

# Django
from django.db import models


class GeneralManager(models.Manager):
    """
    Manager of `General` for the app's own permission rules.

    The API, the menu hook, the charlink hook and the querysets check
    permissions only through this manager. The Django views keep
    `@permission_required("bpforge.basic_access")`. `General` is not managed,
    so these methods never query `General`.
    """

    @staticmethod
    def has_basic_access(user) -> bool:
        """Users with `basic_access` may use the app."""
        return bool(user.has_perm("bpforge.basic_access"))

    @staticmethod
    def has_management_access(user) -> bool:
        """Users with `manage_access` may manage the orders of their corporation."""
        return bool(user.has_perm("bpforge.manage_access"))

    @staticmethod
    def has_admin_access(user) -> bool:
        """Superusers and users with `full_access` have administration access."""
        return bool(user.has_perm("bpforge.full_access"))
