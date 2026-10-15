"""Models for General."""

# Django
from django.db import models
from django.utils.translation import gettext_lazy as _

# Alliance Auth
from allianceauth.authentication.models import User
from allianceauth.groupmanagement.models import Group


class General(models.Model):
    """General model for app permissions"""

    class Meta:
        managed = False
        verbose_name = "AA-Blueprint-Forge"
        verbose_name_plural = "AA-Blueprint-Forge"
        permissions = (
            ("basic_access", _("Can access this app")),
            ("manage_access", _("Can manage")),
            ("full_access", _("Full access")),
        )
        default_permissions = ()  # Remove standard permissions


class UserSettings(models.Model):
    class Meta:
        default_permissions = ()  # Remove standard permissions

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="+",
    )

    disable_notifications = models.BooleanField(default=False)


class GeneralNotificationSettings(models.Model):
    """Global notification settings managed by Superusers."""

    class Meta:
        default_permissions = ()
        verbose_name = _("Notification Settings")
        verbose_name_plural = _("Notification Settings")

    order_created_groups = models.ManyToManyField(
        Group,
        blank=True,
        related_name="bpforge_global_order_created_notifications",
        help_text=_("Groups to notify globally when a new order is created."),
    )

    order_status_groups = models.ManyToManyField(
        Group,
        blank=True,
        related_name="bpforge_global_order_status_notifications",
        help_text=_("Groups to notify globally when an order status changes."),
    )

    @classmethod
    def get_solo(cls) -> "GeneralNotificationSettings":
        obj, _ = cls.objects.get_or_create(id=1)
        return obj
