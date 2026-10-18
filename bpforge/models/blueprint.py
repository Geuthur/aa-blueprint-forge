"""Models for Blueprints."""

# Django
from django.db import models
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _

# Alliance Auth
from allianceauth.authentication.models import CharacterOwnership, User
from allianceauth.eveonline.models import EveCorporationInfo
from allianceauth.groupmanagement.models import Group
from allianceauth.services.hooks import get_extension_logger
from esi.errors import TokenError
from esi.models import Token

# Alliance Auth (External Libs)
from eve_sde.models import ItemType, SolarSystem

# AA Blueprint Forge
from bpforge import __title__
from bpforge.constants import (
    SOLAR_SYSTEM_ID_END,
    SOLAR_SYSTEM_ID_START,
    STATION_ID_END,
    STATION_ID_START,
)
from bpforge.managers import (
    BlueprintManager,
    EveEntityManager,
    LocationManager,
    OwnerManager,
)
from bpforge.models.helpers.core import LocationFlag
from bpforge.models.helpers.update_manager import (
    UpdateManagerMixin,
    UpdateSection,
    UpdateStatusBaseModel,
)
from bpforge.providers import AppLogger

logger = AppLogger(get_extension_logger(__name__), __title__)


class OwnerUpdateStatus(UpdateStatusBaseModel):
    """A Model to track the status of the last update."""

    class Meta:
        default_permissions = ()

    owner = models.ForeignKey(
        "Owner",
        on_delete=models.CASCADE,
        related_name="bpforge_update_status",
    )
    section = models.CharField(
        max_length=32, choices=UpdateSection.choices, db_index=True
    )

    def __str__(self) -> str:
        return f"{self.owner} - {self.section} - {self.is_success}"


class OwnerPublicType(models.TextChoices):
    ALL = "all", _("All (Originals & Copies)")
    BPO_ONLY = "bpo", _("Only Originals (BPO)")
    BPC_ONLY = "bpc", _("Only Copies (BPC)")


class Owner(UpdateManagerMixin, models.Model):

    update_section_class = UpdateSection
    update_status_model = OwnerUpdateStatus

    class Meta:
        default_permissions = ()
        indexes = [
            models.Index(fields=["is_public"], name="bpforge_owner_is_public_idx"),
            models.Index(
                fields=["is_public", "public_type"], name="bpforge_owner_pub_type_idx"
            ),
        ]

    objects: OwnerManager = OwnerManager()

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="+",
    )

    character = models.ForeignKey(
        CharacterOwnership,
        on_delete=models.SET_DEFAULT,
        related_name="+",
        help_text=_("The character that owns this blueprint."),
        default=None,
        null=True,
        blank=True,
    )

    corporation = models.OneToOneField(
        EveCorporationInfo,
        on_delete=models.CASCADE,
        default=None,
        null=True,
        blank=True,
        related_name="+",
        help_text=_("The corporation that owns this blueprint."),
    )

    is_public = models.BooleanField(
        default=False,
        help_text=_("Whether this owner's blueprints are public."),
    )

    public_type = models.CharField(
        max_length=16,
        choices=OwnerPublicType.choices,
        default=OwnerPublicType.ALL,
        help_text=_("Which types of blueprints are public for this owner."),
    )

    selective_bpo_enabled = models.BooleanField(
        default=False,
        help_text=_("Whether only explicitly selected BPOs are offered."),
    )

    notify_order_created_groups = models.ManyToManyField(
        Group,
        blank=True,
        related_name="bpforge_owner_order_created_notifications",
        help_text=_("Groups to notify when a new order is created for this owner."),
    )

    notify_order_status_groups = models.ManyToManyField(
        Group,
        blank=True,
        related_name="bpforge_owner_order_status_notifications",
        help_text=_("Groups to notify when an order status changes for this owner."),
    )

    @property
    def owner(self):
        """Get the owner of the blueprint."""
        if self.character:
            return self.character
        if self.corporation:
            return self.corporation
        return self.user.username

    @property
    def name(self) -> str:
        """Human-readable display name of the owner."""
        if self.corporation:
            return self.corporation.corporation_name
        if self.character:
            return self.character.character.character_name
        return self.user.username

    @property
    def is_corporation(self) -> bool:
        """Whether this owner is a corporation."""
        return bool(self.corporation_id)

    def __str__(self) -> str:
        return self.name

    @staticmethod
    def get_corporation_scopes():
        return [
            "esi-assets.read_corporation_assets.v1",
            "esi-industry.read_corporation_jobs.v1",
            "esi-universe.read_structures.v1",
            "esi-corporations.read_blueprints.v1",
        ]

    @staticmethod
    def get_character_scopes():
        return [
            "esi-assets.read_assets.v1",
            "esi-industry.read_character_jobs.v1",
            "esi-universe.read_structures.v1",
            "esi-characters.read_blueprints.v1",
        ]

    @cached_property
    def token(self):
        """Get the token for this owner."""
        if not self.character:
            raise TokenError(
                f"{self}: No character configured to provide an ESI token."
            )

        if self.corporation:
            scopes = self.get_corporation_scopes()
        else:
            scopes = self.get_character_scopes()

        token = (
            Token.objects.filter(
                user=self.character.user,
                character_id=self.character.character.character_id,
            )
            .require_scopes(scopes)
            .require_valid()
            .first()
        )

        if not token:
            corp_name = (
                self.corporation.corporation_name if self.corporation else "Unknown"
            )
            raise TokenError(f"Token not found for corporation {corp_name}")
        return token

    def update_blueprints(self, force_refresh: bool = False) -> None:
        """Start Update Proccess for blueprints"""
        return Blueprint.objects.update_or_create_blueprints(self, force_refresh)

    def update_locations(self, force_refresh: bool = False) -> None:
        """Start Update Proccess for locations"""
        return Location.objects.update_or_create_locations(self, force_refresh)


class Blueprint(models.Model):
    """Blueprint model"""

    class Meta:
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "item_id"],
                name="bpforge_blueprint_owner_item_id_unique",
            )
        ]
        indexes = [
            models.Index(fields=["owner", "runs"], name="bpforge_bp_owner_runs_idx"),
            models.Index(
                fields=["owner", "is_offered"], name="bpforge_bp_owner_offered_idx"
            ),
            models.Index(
                fields=["owner", "eve_type"], name="bpforge_bp_owner_type_idx"
            ),
            models.Index(fields=["runs"], name="bpforge_bp_runs_idx"),
        ]

    objects: BlueprintManager = BlueprintManager()

    id = models.BigAutoField(
        auto_created=True,
        primary_key=True,
        serialize=False,
        verbose_name="ID",
    )

    item_id = models.BigIntegerField(
        help_text=_("The Eve ID of this blueprint."),
        db_index=True,
    )

    owner = models.ForeignKey(
        Owner,
        on_delete=models.CASCADE,
        related_name="bpforge_blueprints",
        help_text=_("The owner of this blueprint."),
    )

    eve_type = models.ForeignKey(
        ItemType,
        on_delete=models.CASCADE,
        related_name="+",
        help_text=_("The Eve type of this blueprint."),
    )

    location = models.ForeignKey(
        "Location",
        on_delete=models.CASCADE,
        related_name="+",
        help_text=_("The location of this blueprint."),
    )

    location_flag = models.CharField(
        help_text=_("The flag of this blueprint."),
        choices=LocationFlag.choices,
        max_length=36,
    )

    quantity = models.PositiveIntegerField(
        help_text=_("The quantity of this blueprint."),
        default=1,
    )

    runs = models.PositiveIntegerField(
        blank=True,
        null=True,
        help_text=_("The number of runs for this blueprint."),
    )
    material_efficency = models.PositiveIntegerField(
        blank=True,
        null=True,
        help_text=_("The material efficiency of this blueprint."),
    )

    time_efficiency = models.PositiveIntegerField(
        blank=True,
        null=True,
        help_text=_("The time efficiency of this blueprint."),
    )

    is_offered = models.BooleanField(
        default=False,
        help_text=_(
            "Whether this blueprint is offered when selective BPO mode is enabled."
        ),
    )

    @property
    def is_original(self):
        """Return True if this blueprint is an original."""
        return not self.runs

    @property
    def is_corp_bp(self):
        """Return True if this blueprint is a corporation blueprint."""
        return self.owner.corporation is not None

    def __str__(self):
        return f"{self.eve_type} ({self.runs})"


class Location(models.Model):
    """Location model"""

    class Meta:
        default_permissions = ()

    objects: LocationManager = LocationManager()

    location_id = models.BigIntegerField(
        primary_key=True,
        help_text=_("The Eve ID of this location."),
    )

    name = models.CharField(
        max_length=100,
        help_text=_("The name of this location."),
    )

    parent = models.ForeignKey(
        "Location",
        on_delete=models.SET_DEFAULT,
        default=None,
        null=True,
        blank=True,
        related_name="+",
        help_text=_("The parent location of this location."),
    )

    solar_system = models.ForeignKey(
        SolarSystem,
        on_delete=models.SET_DEFAULT,
        default=None,
        null=True,
        blank=True,
        related_name="+",
        help_text=_("The solar system of this location."),
    )

    eve_type = models.ForeignKey(
        ItemType,
        on_delete=models.SET_DEFAULT,
        default=None,
        null=True,
        blank=True,
        related_name="+",
        help_text=_("The Eve type of this location."),
    )

    owner = models.ForeignKey(
        "EveEntity",
        on_delete=models.SET_DEFAULT,
        default=None,
        null=True,
        blank=True,
        related_name="+",
        help_text=_("The owner of this location."),
    )

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.eve_type})"

    @property
    def is_station(self):
        """Return True if this location is a station."""
        return self.is_station_id(location_id=self.location_id)

    @property
    def is_solar_system(self):
        """Return True if this location is a solar system."""
        return self.is_solar_system_id(location_id=self.location_id)

    @staticmethod
    def is_station_id(location_id: int) -> bool:
        return STATION_ID_START <= location_id <= STATION_ID_END

    @staticmethod
    def is_solar_system_id(location_id: int) -> bool:
        return SOLAR_SYSTEM_ID_START <= location_id <= SOLAR_SYSTEM_ID_END


class EveEntity(models.Model):
    class Meta:
        default_permissions = ()

    objects: EveEntityManager = EveEntityManager()

    eve_id = models.BigIntegerField(
        primary_key=True,
        help_text=_("The Eve ID of this entity."),
    )

    name = models.CharField(
        max_length=100,
        help_text=_("The name of this entity."),
    )

    category = models.CharField(
        max_length=50,
        help_text=_("The category of this entity."),
    )

    def __str__(self):
        return f"{self.name} ({self.category})"
