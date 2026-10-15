"""
Factory for Alliance Auth and Django EVE SDE.

This module provides factory classes for generating test data for Alliance Auth and Django EVE SDE.
"""

# Standard Library
from typing import Generic, TypeVar

# Third Party
import factory
import factory.fuzzy

# Django
from django.contrib.auth import get_user_model
from django.db.models import Max

# Alliance Auth
from allianceauth.eveonline.models import (
    EveAllianceInfo,
    EveCharacter,
    EveCorporationInfo,
)
from allianceauth.tests.auth_utils import AuthUtils

T = TypeVar("T")
User = get_user_model()


class BaseMetaFactory(Generic[T], factory.base.FactoryMetaClass):
    def __call__(cls, *args, **kwargs) -> T:
        return super().__call__(*args, **kwargs)


class UserFactory(factory.django.DjangoModelFactory, metaclass=BaseMetaFactory[User]):
    """Generate a User object."""

    class Meta:
        model = User
        django_get_or_create = ("username",)
        exclude = ("_generated_name",)

    _generated_name = factory.Faker("name")
    username = factory.LazyAttribute(lambda obj: obj._generated_name.replace(" ", "_"))
    first_name = factory.LazyAttribute(lambda obj: obj._generated_name.split(" ")[0])
    last_name = factory.LazyAttribute(lambda obj: obj._generated_name.split(" ")[1])
    email = factory.LazyAttribute(
        lambda obj: f"{obj.first_name.lower()}.{obj.last_name.lower()}@example.com"
    )

    @factory.post_generation
    def permissions(obj, create, extracted, **kwargs):
        """Set default permissions. Overwrite with `permissions=["app.perm1"]`."""
        if not create:
            return
        permissions = extracted or []
        for permission_name in permissions:
            AuthUtils.add_permission_to_user_by_name(permission_name, obj)

    @factory.post_generation
    def scopes(obj, create, extracted, **kwargs):
        """Set default scopes. Overwrite with `scopes=["scope1"]`."""
        if not create:
            return
        scopes = extracted or []
        obj._main_character_scopes = scopes

    @classmethod
    def _after_postgeneration(cls, obj, create, results=None):
        """Reset permission cache to force an update."""
        super()._after_postgeneration(obj, create, results)
        if hasattr(obj, "_perm_cache"):
            del obj._perm_cache
        if hasattr(obj, "_user_perm_cache"):
            del obj._user_perm_cache


class EveAllianceInfoFactory(
    factory.django.DjangoModelFactory, metaclass=BaseMetaFactory[EveAllianceInfo]
):
    """Generate an EveAllianceInfo object."""

    class Meta:
        model = EveAllianceInfo
        django_get_or_create = ("alliance_id", "alliance_name")

    alliance_name = factory.Faker("catch_phrase")
    alliance_ticker = factory.LazyAttribute(lambda obj: obj.alliance_name[:4].upper())
    executor_corp_id = 0

    @factory.lazy_attribute
    def alliance_id(self):
        last_id = (
            EveAllianceInfo.objects.aggregate(Max("alliance_id"))["alliance_id__max"]
            or 99_000_000
        )
        return last_id + 1


class EveCorporationInfoFactory(
    factory.django.DjangoModelFactory, metaclass=BaseMetaFactory[EveCorporationInfo]
):
    """Generate an EveCorporationInfo object."""

    class Meta:
        model = EveCorporationInfo
        django_get_or_create = ("corporation_id", "corporation_name")

    corporation_name = factory.Faker("catch_phrase")
    corporation_ticker = factory.LazyAttribute(
        lambda obj: obj.corporation_name[:4].upper()
    )
    member_count = factory.fuzzy.FuzzyInteger(1000)

    @factory.lazy_attribute
    def corporation_id(self):
        last_id = (
            EveCorporationInfo.objects.aggregate(Max("corporation_id"))[
                "corporation_id__max"
            ]
            or 98_000_000
        )
        return last_id + 1

    @factory.post_generation
    def create_alliance(obj, create, extracted, **kwargs):
        if not create or extracted is False or obj.alliance:
            return
        obj.alliance = EveAllianceInfoFactory(executor_corp_id=obj.corporation_id)


class EveCharacterFactory(
    factory.django.DjangoModelFactory, metaclass=BaseMetaFactory[EveCharacter]
):
    """
    Generate an EveCharacter object.

    Args:
        character_name (str): The name of the EveCharacter.
        corporation (EveCorporationInfo, optional): The EveCorporationInfo object associated with the character. If not provided, it will be created.
        corporation_id (int): The ID of the corporation associated with the character.
        corporation_name (str): The name of the corporation associated with the character.
        corporation_ticker (str): The ticker of the corporation associated with the character.
        character_id (int): The unique ID for the character. If not provided, it will be generated.
        alliance (EveAllianceInfo, optional): The EveAllianceInfo object associated with the character's corporation. If not provided, it will be derived from the corporation.
        alliance_id (int): The ID of the alliance associated with the character's corporation. If not provided, it will be derived from the corporation.
        alliance_name (str): The name of the alliance associated with the character's corporation. If not provided, it will be derived from the corporation.
        alliance_ticker (str): The ticker of the alliance associated with the character's corporation. If not provided, it will be derived from the corporation.
    """

    class Meta:
        model = EveCharacter
        django_get_or_create = ("character_id", "character_name")
        exclude = ("corporation", "alliance")

    character_name = factory.Faker("name")
    corporation = factory.SubFactory(EveCorporationInfoFactory)
    corporation_id = factory.LazyAttribute(lambda obj: obj.corporation.corporation_id)
    corporation_name = factory.LazyAttribute(
        lambda obj: obj.corporation.corporation_name
    )
    corporation_ticker = factory.LazyAttribute(
        lambda obj: obj.corporation.corporation_ticker
    )

    alliance = factory.LazyAttribute(lambda obj: obj.corporation.alliance)

    @factory.lazy_attribute
    def character_id(self):
        last_id = (
            EveCharacter.objects.aggregate(Max("character_id"))["character_id__max"]
            or 90_000_000
        )
        return last_id + 1

    @factory.lazy_attribute
    def alliance_id(self):
        return self.alliance.alliance_id if self.alliance else None

    @factory.lazy_attribute
    def alliance_name(self):
        return self.alliance.alliance_name if self.alliance else ""

    @factory.lazy_attribute
    def alliance_ticker(self):
        return self.alliance.alliance_ticker if self.alliance else ""
