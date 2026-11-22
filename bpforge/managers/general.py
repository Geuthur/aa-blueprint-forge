"""Access control for the app: querysets and managers with `visible_to` and `manage_to`."""

# Standard Library
from typing import Generic, TypeVar

# Django
from django.db import models

# Alliance Auth
from allianceauth.eveonline.models import EveCharacter

# AA Blueprint Forge
from bpforge.providers import logger

T = TypeVar("T", bound=models.Model)


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


class AccessQuerySet(models.QuerySet[T], Generic[T]):
    """
    A QuerySet with access control methods for the whole Application.

    The default rules assume a `user` foreign key and an `is_public` flag, as
    on `Owner`: a user sees their own and all public objects and manages only
    their own. Override `owned_by_q`, `visible_q` and `manage_q` in a subclass
    when a model needs other rules.

    Methods:
        visible_to(user): Returns objects visible to the given user.
        manage_to(user): Returns objects the given user can manage.
    """

    def owned_by_q(self, user) -> models.Q:
        """Q object for the objects that belong to the user."""
        return models.Q(user=user)

    def visible_q(self, user) -> models.Q:
        """Q object for the objects a user without admin access may see."""
        return self.owned_by_q(user) | models.Q(is_public=True)

    def manage_q(self, user) -> models.Q:
        """Q object for the objects a user without admin access may manage."""
        return self.owned_by_q(user)

    def _restricted_to(self, user, query: models.Q, what: str):
        if GeneralManager.has_admin_access(user):
            logger.debug("Returning all %s objects for %s.", what, user)
            return self

        if not getattr(user.profile, "main_character", None):
            logger.debug("User %s has no main character. Nothing %s.", user, what)
            return self.none()

        return self.filter(query)

    def visible_to(self, user):
        """Get all objects visible to the user."""
        return self._restricted_to(user, self.visible_q(user), "visible")

    def manage_to(self, user):
        """Get QuerySet of objects that the user can manage."""
        return self._restricted_to(user, self.manage_q(user), "manageable")


class AccessManager(models.Manager[T], Generic[T]):
    """
    A Manager with access control methods for the whole Application

    This manager provides methods to filter querysets based on user permissions,
    such as `visible_to` and `manage_to`, ensuring that users only see or manage
    the objects they are allowed to.
    """

    def get_queryset(self) -> AccessQuerySet[T]:
        return AccessQuerySet(self.model, using=self._db)

    def visible_to(self, user):
        return self.get_queryset().visible_to(user)

    def manage_to(self, user):
        return self.get_queryset().manage_to(user)

    @staticmethod
    def visible_eve_characters(user):
        """EveCharacters a user may pick, e.g. when adding an owner."""
        qs = EveCharacter.objects.get_queryset()
        if GeneralManager.has_admin_access(user):
            logger.debug("Returning all characters for %s.", user)
            return qs.all()

        if not getattr(user.profile, "main_character", None):
            logger.debug("User %s has no main character. Nothing visible.", user)
            return qs.none()

        return qs.filter(character_ownership__user=user)
