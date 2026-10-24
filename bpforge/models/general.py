"""Models for General."""

# Standard Library
from typing import Any

# Django
from django.db import models
from django.utils.translation import gettext_lazy as _

# Alliance Auth
from allianceauth.authentication.models import CharacterOwnership, User
from allianceauth.groupmanagement.models import Group


class General(models.Model):
    """General model for app permissions and permission helpers."""

    class Permission(models.TextChoices):
        """All permissions of this app (codename, description)."""

        BASIC_ACCESS = "basic_access", _("Can access this app")
        MANAGE_ACCESS = "manage_access", _("Can manage")
        FULL_ACCESS = "full_access", _("Full access")

    class Meta:
        managed = False
        verbose_name = "AA-Blueprint-Forge"
        verbose_name_plural = "AA-Blueprint-Forge"
        default_permissions = ()  # Remove standard permissions

    # Inject dynamic permissions
    Meta.permissions = Permission.choices

    @classmethod
    def get_perm(cls, perm: "str | Permission") -> str:
        """Return full permission string 'bpforge.<codename>'."""
        codename = perm.value if isinstance(perm, cls.Permission) else perm
        return f"bpforge.{codename}"

    @classmethod
    def has_perm(cls, user: Any, perm: "str | General.Permission") -> bool:
        """Check if user has permission."""
        if not user or not hasattr(user, "has_perm"):
            return False
        return user.has_perm(cls.get_perm(perm))

    @classmethod
    def has_any_perm(cls, user: Any, *perms: "str | General.Permission") -> bool:
        """Return True if user has any of the specified permissions."""
        if not user or not hasattr(user, "has_perm"):
            return False
        return any(user.has_perm(cls.get_perm(p)) for p in perms)

    @classmethod
    def has_administration_access(cls, user: Any) -> bool:
        """Check if user has full (administration) access."""
        return cls.has_perm(user, cls.Permission.FULL_ACCESS)

    @staticmethod
    def get_user_corporation_ids(user: User) -> set[int]:
        """Retrieve all corporation IDs associated with a user."""
        corp_ids: set[int] = set()
        try:
            if (
                user.profile.main_character
                and user.profile.main_character.corporation_id
            ):
                corp_ids.add(user.profile.main_character.corporation_id)
        except Exception:  # pylint: disable=broad-exception-caught
            pass
        corp_ids.update(
            CharacterOwnership.objects.filter(user=user).values_list(
                "character__corporation_id", flat=True
            )
        )
        return corp_ids

    @classmethod
    def is_global_order_manager(cls, user: User) -> bool:
        """Check if user has global management rights over all orders."""
        if not user or not user.is_authenticated:
            return False
        if cls.has_administration_access(user):
            return True
        settings_obj = GeneralNotificationSettings.get_solo()
        user_group_ids = set(user.groups.values_list("id", flat=True))
        manager_group_ids = set(
            settings_obj.order_created_groups.values_list("id", flat=True)
        ) | set(settings_obj.order_status_groups.values_list("id", flat=True))
        return bool(user_group_ids & manager_group_ids)

    @classmethod
    def is_corp_order_manager(cls, user: User) -> bool:
        """Check if user has management rights over their corporation's orders."""
        if not user or not user.is_authenticated:
            return False
        return cls.has_perm(user, cls.Permission.MANAGE_ACCESS)

    @classmethod
    def can_manage_orders(cls, user: User) -> bool:
        """Check if user can manage orders either globally or for their corporation."""
        return cls.is_global_order_manager(user) or cls.is_corp_order_manager(user)

    @classmethod
    def get_manageable_orders_filter(cls, user: User) -> models.Q | None:
        """Return a Q filter for manageable orders for the given user, or None if no rights."""
        if cls.is_global_order_manager(user):
            return models.Q()
        if cls.is_corp_order_manager(user):
            corp_ids = cls.get_user_corporation_ids(user)
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

    @classmethod
    def can_manage_order(cls, user: User, order) -> bool:
        """Check if a specific order can be managed by the given user."""
        if cls.is_global_order_manager(user):
            return True
        if cls.is_corp_order_manager(user):
            corp_ids = cls.get_user_corporation_ids(user)
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
                CharacterOwnership.objects.filter(
                    user=order.requesting_user
                ).values_list("character__corporation_id", flat=True)
            )
            if corp_ids & buyer_corps:
                return True
        return False


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
    """Global notification settings managed by Administration."""

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
