"""Models for General."""

# Django
from django.db import models
from django.utils.translation import gettext_lazy as _

# Alliance Auth
from allianceauth.authentication.models import CharacterOwnership, User
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


def get_user_corporation_ids(user: User) -> set[int]:
    """Retrieve all corporation IDs associated with a user."""
    corp_ids: set[int] = set()
    try:
        if user.profile.main_character and user.profile.main_character.corporation_id:
            corp_ids.add(user.profile.main_character.corporation_id)
    except Exception:  # pylint: disable=broad-exception-caught
        pass
    corp_ids.update(
        CharacterOwnership.objects.filter(user=user).values_list(
            "character__corporation_id", flat=True
        )
    )
    return corp_ids


def user_is_global_order_manager(user: User) -> bool:
    """Check if user has global management rights over all orders."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.has_perm("bpforge.full_access"):
        return True
    settings_obj = GeneralNotificationSettings.get_solo()
    user_group_ids = set(user.groups.values_list("id", flat=True))
    manager_group_ids = set(
        settings_obj.order_created_groups.values_list("id", flat=True)
    ) | set(settings_obj.order_status_groups.values_list("id", flat=True))
    return bool(user_group_ids & manager_group_ids)


def user_is_corp_order_manager(user: User) -> bool:
    """Check if user has management rights over their corporation's orders."""
    if not user or not user.is_authenticated:
        return False
    return user.has_perm("bpforge.manage_access")


def user_can_manage_orders(user: User) -> bool:
    """Check if user can manage orders either globally or for their corporation."""
    return user_is_global_order_manager(user) or user_is_corp_order_manager(user)


def get_manageable_orders_filter(user: User) -> models.Q | None:
    """Return a Q filter for manageable orders for the given user, or None if no rights."""
    if user_is_global_order_manager(user):
        return models.Q()
    if user_is_corp_order_manager(user):
        corp_ids = get_user_corporation_ids(user)
        return (
            models.Q(owner__corporation__corporation_id__in=corp_ids)
            | models.Q(owner__character__character__corporation_id__in=corp_ids)
            | models.Q(
                requesting_user__profile__main_character__corporation_id__in=corp_ids
            )
            | models.Q(
                requesting_user__in=CharacterOwnership.objects.filter(
                    character__corporation_id__in=corp_ids
                ).values_list("user_id", flat=True)
            )
        )
    return None


def user_can_manage_order(user: User, order) -> bool:
    """Check if a specific order can be managed by the given user."""
    if user_is_global_order_manager(user):
        return True
    if user_is_corp_order_manager(user):
        corp_ids = get_user_corporation_ids(user)
        if (
            order.owner.corporation
            and order.owner.corporation.corporation_id in corp_ids
        ):
            return True
        if (
            order.owner.character
            and order.owner.character.character.corporation_id in corp_ids
        ):
            return True
        buyer_corps = set()
        try:
            if order.requesting_user.profile.main_character:
                buyer_corps.add(
                    order.requesting_user.profile.main_character.corporation_id
                )
        except Exception:  # pylint: disable=broad-exception-caught
            pass
        buyer_corps.update(
            CharacterOwnership.objects.filter(user=order.requesting_user).values_list(
                "character__corporation_id", flat=True
            )
        )
        if corp_ids & buyer_corps:
            return True
    return False
