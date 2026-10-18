"""Test factories for bpforge models."""

# Standard Library
from dataclasses import dataclass

# Third Party
import factory
from evesde_factory.allianceauth import BaseMetaFactory
from evesde_factory.eve_sde import (
    ItemCategoryFactory,
    ItemGroupFactory,
    ItemTypeFactory,
)

# Alliance Auth
from allianceauth.groupmanagement.models import Group

# AA Blueprint Forge
from bpforge.models.blueprint import Blueprint, Location, Owner
from bpforge.models.request import Order, Request
from bpforge.tests.testdata.app import UserMainFactory


class GroupFactory(factory.django.DjangoModelFactory, metaclass=BaseMetaFactory[Group]):
    """Generate a Group object for testing."""

    class Meta:
        model = Group
        django_get_or_create = ("name",)

    name = factory.Sequence(lambda n: f"Test Group {n}")


class OwnerFactory(factory.django.DjangoModelFactory, metaclass=BaseMetaFactory[Owner]):
    """Generate an Owner object for testing."""

    class Meta:
        model = Owner
        django_get_or_create = ("user", "character")

    user = factory.SubFactory(UserMainFactory)
    character = factory.LazyAttribute(
        lambda obj: (
            obj.user.profile.main_character.character_ownership
            if hasattr(obj.user, "profile")
            and obj.user.profile
            and obj.user.profile.main_character
            else None
        )
    )
    is_public = True
    public_type = "all"
    selective_bpo_enabled = False


class OwnerUpdateStatusFactory(
    factory.django.DjangoModelFactory, metaclass=BaseMetaFactory[Owner]
):
    """Generate an OwnerUpdateStatus object for testing."""

    class Meta:
        model = "bpforge.OwnerUpdateStatus"

    owner = factory.SubFactory(OwnerFactory)
    section = "blueprints"
    is_success = True


class LocationFactory(
    factory.django.DjangoModelFactory, metaclass=BaseMetaFactory[Location]
):
    """Generate a Location object for testing."""

    class Meta:
        model = Location
        django_get_or_create = ("location_id",)

    location_id = factory.Sequence(lambda n: 60000000 + n)
    name = factory.Sequence(lambda n: f"Station {n}")


class BlueprintFactory(
    factory.django.DjangoModelFactory, metaclass=BaseMetaFactory[Blueprint]
):
    """Generate a Blueprint object for testing."""

    class Meta:
        model = Blueprint

    item_id = factory.Sequence(lambda n: 1000000 + n)
    owner = factory.SubFactory(OwnerFactory)
    eve_type = factory.SubFactory(ItemTypeFactory)
    location = factory.SubFactory(LocationFactory)
    location_flag = "Hangar"
    quantity = 1
    runs = None
    material_efficency = 10
    time_efficiency = 20
    is_offered = True


class OrderFactory(factory.django.DjangoModelFactory, metaclass=BaseMetaFactory[Order]):
    """Generate an Order object for testing."""

    class Meta:
        model = Order

    owner = factory.SubFactory(OwnerFactory)
    requesting_user = factory.SubFactory(UserMainFactory)
    status = "Pending"
    note = ""


class RequestFactory(
    factory.django.DjangoModelFactory, metaclass=BaseMetaFactory[Request]
):
    """Generate a Request (order item) object for testing."""

    class Meta:
        model = Request

    order = factory.SubFactory(OrderFactory)
    blueprint = factory.SubFactory(BlueprintFactory)
    requesting_user = factory.LazyAttribute(lambda obj: obj.order.requesting_user)
    quantity = 1
    runs = None
    status = "Pending"


@dataclass
class EsiBlueprintItemData:
    """Mock item matching ESI blueprint response structure."""

    item_id: int
    type_id: int
    location_id: int
    location_flag: str
    quantity: int = 1
    runs: int | None = None
    material_efficiency: int = 10
    time_efficiency: int = 20
