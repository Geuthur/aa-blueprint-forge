# Standard Library
from http import HTTPStatus
from typing import TYPE_CHECKING, Union

# Django
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.utils import timezone

# Alliance Auth
from esi.exceptions import HTTPClientError
from esi.models import Token

# Alliance Auth (External Libs)
from eve_sde.models import ItemType, SolarSystem

# AA Blueprint Forge
from bpforge.app_settings import BPFORGE_BULK_BATCH_SIZE
from bpforge.managers.general import AccessManager, AccessQuerySet
from bpforge.models.helpers.core import LocationFlag
from bpforge.models.helpers.update_manager import OwnerUpdateSection
from bpforge.providers import esi, logger

if TYPE_CHECKING:
    # Alliance Auth
    from esi.stubs import (
        CharactersCharacterIdAssetsGetItem,
        CharactersCharacterIdBlueprintsGetItem,
        CorporationsCorporationIdAssetsGetItem,
    )

    # AA Blueprint Forge
    from bpforge.models.blueprint import Blueprint as BlueprintContext
    from bpforge.models.blueprint import EveEntity as EveEntityContext
    from bpforge.models.blueprint import Location as LocationContext
    from bpforge.models.blueprint import Owner as OwnerContext


class OwnerQuerySet(AccessQuerySet):
    """Owners use the default rules of `AccessQuerySet`."""


class OwnerManager(AccessManager["OwnerContext"]):
    def get_queryset(self) -> OwnerQuerySet:
        return OwnerQuerySet(self.model, using=self._db)


class BlueprintQuerySet(AccessQuerySet):
    """Blueprints follow the rules of their owner."""

    def owned_by_q(self, user) -> models.Q:
        return models.Q(owner__user=user)

    def visible_q(self, user) -> models.Q:
        return self.owned_by_q(user) | models.Q(owner__is_public=True)

    def in_catalog(self):
        """
        Blueprints their owner offers in the catalog.

        Follows `public_type` of the owner (an unknown value counts as "all")
        and, with `selective_bpo_enabled`, shows only the offered BPOs. It does
        not check who may see the owner: combine it with `is_public` or
        `Owner.objects.visible_to`.
        """
        is_copy = models.Q(runs__gt=0)
        is_original = models.Q(runs__isnull=True) | models.Q(runs=0)
        return self.filter(
            (models.Q(owner__public_type="bpo") & is_original)
            | (models.Q(owner__public_type="bpc") & is_copy)
            | ~models.Q(owner__public_type__in=["bpo", "bpc"])
        ).filter(
            models.Q(owner__selective_bpo_enabled=False)
            | is_copy
            | models.Q(is_offered=True)
        )

    def with_api_relations(self):
        """Preload related objects commonly needed for API representation."""
        return self.select_related(
            "eve_type__group",
            "location__parent",
            "owner__character__character",
            "owner__corporation",
        )

    def with_catalog_relations(self):
        """Preload related objects commonly needed for catalog representation (locations omitted)."""
        return self.select_related(
            "eve_type__group",
            "owner__character__character",
            "owner__corporation",
        )


class BlueprintManager(AccessManager["BlueprintContext"]):
    def get_queryset(self) -> BlueprintQuerySet:
        return BlueprintQuerySet(self.model, using=self._db)

    def with_api_relations(self):
        """Preload related objects commonly needed for API representation."""
        return self.get_queryset().with_api_relations()

    def with_catalog_relations(self):
        """Preload related objects commonly needed for catalog representation (locations omitted)."""
        return self.get_queryset().with_catalog_relations()

    def update_or_create_blueprints(
        self, owner: "OwnerContext", force_refresh: bool = False
    ):
        """Update or Create Blueprints for this owner"""
        return owner.update_manager.update_section_if_changed(
            section=OwnerUpdateSection.BLUEPRINTS,
            fetch_func=self._fetch_blueprint_esi_data,
            force_refresh=force_refresh,
        )

    def _fetch_blueprint_esi_data(
        self, owner: "OwnerContext", force_refresh: bool = False
    ):
        if owner.corporation:
            blueprints = esi.client.Corporation.GetCorporationsCorporationIdBlueprints(
                corporation_id=owner.corporation.corporation_id,
                token=owner.token,
            ).results(use_etag=False, force_refresh=force_refresh)
        else:
            blueprints = esi.client.Character.GetCharactersCharacterIdBlueprints(
                character_id=owner.character.character.character_id,
                token=owner.token,
            ).results(use_etag=False, force_refresh=force_refresh)

        self._update_or_create_objs(owner=owner, objs=blueprints)

    def _update_or_create_objs(
        self,
        owner: "OwnerContext",
        objs: list["CharactersCharacterIdBlueprintsGetItem"],
    ):
        # AA Blueprint Forge
        # pylint: disable=import-outside-toplevel

        # AA Blueprint Forge
        from bpforge.models.blueprint import Location

        existing_items = {bp.item_id: bp for bp in self.filter(owner=owner)}

        new_items = []
        old_items = []
        seen_item_ids = set()

        for obj in objs:
            if obj.item_id in seen_item_ids:
                continue
            seen_item_ids.add(obj.item_id)

            runs = obj.runs
            if obj.runs is None or obj.runs < 1:
                runs = None  # Original Blueprint

            quantity = obj.quantity
            if quantity < 0:
                quantity = 1
            try:
                eve_type = ItemType.objects.get(id=obj.type_id)
            except ObjectDoesNotExist as exc:
                raise ValueError(f"ItemType with ID {obj.type_id} not found.") from exc

            location_flag = LocationFlag.from_esi_data(obj.location_flag)
            location = Location.objects.get_or_create(location_id=obj.location_id)[0]

            if obj.item_id in existing_items:
                item = existing_items[obj.item_id]
                item.eve_type = eve_type
                item.material_efficency = obj.material_efficiency
                item.time_efficiency = obj.time_efficiency
                item.runs = runs
                item.quantity = quantity
                item.location_flag = location_flag
                item.location = location
                old_items.append(item)
            else:
                item = self.model(
                    item_id=obj.item_id,
                    owner=owner,
                    eve_type=eve_type,
                    material_efficency=obj.material_efficiency,
                    time_efficiency=obj.time_efficiency,
                    runs=runs,
                    quantity=quantity,
                    location_flag=location_flag,
                    location=location,
                )
                new_items.append(item)

        if new_items:
            self.bulk_create(
                objs=new_items,
                batch_size=BPFORGE_BULK_BATCH_SIZE,
            )

        if old_items:
            self.bulk_update(
                objs=old_items,
                fields=[
                    "eve_type",
                    "material_efficency",
                    "time_efficiency",
                    "runs",
                    "quantity",
                    "location_flag",
                    "location",
                ],
                batch_size=BPFORGE_BULK_BATCH_SIZE,
            )

        to_delete_item_ids = set(existing_items.keys()) - seen_item_ids
        if to_delete_item_ids:
            if not seen_item_ids:
                logger.warning(
                    "ESI returned no blueprints for %s, deleting all %s existing blueprints.",
                    owner,
                    len(to_delete_item_ids),
                )
            self.filter(owner=owner, item_id__in=to_delete_item_ids).delete()


class LocationQuerySet(models.QuerySet):
    """Locations belong to no user, so they carry no access rules."""


class LocationManager(models.Manager["LocationContext"]):
    def get_queryset(self) -> LocationQuerySet:
        return LocationQuerySet(self.model, using=self._db)

    def update_or_create_locations(
        self, owner: "OwnerContext", force_refresh: bool = False
    ):
        """Update or Create Locations for this owner"""
        return owner.update_manager.update_section_if_changed(
            section=OwnerUpdateSection.LOCATIONS,
            fetch_func=self._fetch_location_esi_data,
            force_refresh=force_refresh,
        )

    def _fetch_location_esi_data(
        self, owner: "OwnerContext", force_refresh: bool = False
    ):
        if owner.corporation:
            locations = esi.client.Assets.GetCorporationsCorporationIdAssets(
                corporation_id=owner.corporation.corporation_id,
                token=owner.token,
            ).results(use_etag=False, force_refresh=force_refresh)
        else:
            locations = esi.client.Assets.GetCharactersCharacterIdAssets(
                character_id=owner.character.character.character_id,
                token=owner.token,
            ).results(use_etag=False, force_refresh=force_refresh)

        self._update_or_create_objs(owner=owner, objs=locations)

    def _update_or_create_objs(
        self,
        owner: "OwnerContext",
        objs: list[
            Union[
                "CorporationsCorporationIdAssetsGetItem",
                "CharactersCharacterIdAssetsGetItem",
            ]
        ],
    ):
        asset_ids = []
        asset_locations = {}
        assets_by_id = {}
        for asset in objs:
            asset_ids.append(asset.item_id)
            assets_by_id[asset.item_id] = asset

        for asset in objs:
            if asset.location_id in asset_ids:
                location_id = asset.location_id
                if asset_locations.get(location_id):
                    asset_locations[location_id].append(asset.item_id)
                else:
                    asset_locations[location_id] = [asset.item_id]

        for location_id in asset_locations:
            asset = assets_by_id[location_id]
            parent_location = asset.location_id
            parent = self.get_or_create_esi(
                location_id=parent_location, token=owner.token
            )[0]
            try:
                eve_type = ItemType.objects.get(id=asset.type_id)
            except ObjectDoesNotExist:
                logger.warning(
                    f"Location {location_id} has unknown item type {asset.type_id}, skipping location."
                )
                continue
            self.update_or_create(
                location_id=location_id,
                defaults={"parent": parent, "eve_type": eve_type},
            )

        # Blueprints directly in a hangar have no container whose parent names the location.
        # Only the assets tell stations and structures apart from containers.
        container_parent_ids = {
            assets_by_id[location_id].location_id for location_id in asset_locations
        }
        root_location_ids = {
            asset.location_id
            for asset in objs
            if asset.location_id not in assets_by_id
            and asset.location_id not in container_parent_ids
        }
        blueprint_location_ids = set(
            owner.bpforge_blueprints.filter(
                location_id__in=root_location_ids
            ).values_list("location_id", flat=True)
        )
        for location_id in blueprint_location_ids:
            self.get_or_create_esi(location_id=location_id, token=owner.token)

    def get_or_create_esi(self, location_id: int, token: Token):
        """Get or Create location object with data fetched from ESI.

        Args:
            location_id (int): The ID of the location.
            token (Token): The token to use for authentication.
        """
        return self._get_or_create_esi(location_id=location_id, token=token)

    def _get_or_create_esi(
        self,
        location_id: int,
        token: Token,
    ):
        empty_threshold = timezone.now() - timezone.timedelta(minutes=5)
        stale_threshold = timezone.now() - timezone.timedelta(days=1)

        try:
            location = (
                self.exclude(eve_type__isnull=True, solar_system__isnull=True)
                .exclude(updated_at__lt=empty_threshold)  # Exclude empty locations
                .exclude(updated_at__lt=stale_threshold)  # Exclude stale locations
                .get(location_id=location_id)
            )
            logger.debug(
                "Location %s found and not stale. Returning from cache.", location
            )
            return location, False
        except ObjectDoesNotExist:
            return self.update_or_create_esi(location_id=location_id, token=token)

    def update_or_create_esi(self, location_id: int, token: Token):
        """Update or create a location object with data from ESI.

        Args:
            location_id (int): The ID of the location.
            token (Token): The token to use for authentication.
        """
        return self._update_from_esi(location_id=location_id, token=token)

    def _update_from_esi(
        self, location_id: int, token: Token
    ) -> tuple["LocationContext", bool]:
        """Update a location object with data from ESI.

        Args:
            location_id (int): The ID of the location.
            token (Token): The token to use for authentication.
        """
        # AA Blueprint Forge
        # pylint: disable=import-outside-toplevel

        # AA Blueprint Forge
        from bpforge.models.blueprint import EveEntity

        if self.model.is_solar_system_id(location_id):
            try:
                solar_system = SolarSystem.objects.get(id=location_id)
                eve_type = ItemType.objects.get(id=5)
                location, created = self.update_or_create(
                    location_id=location_id,
                    defaults={
                        "name": solar_system.name,
                        "solar_system": solar_system,
                        "eve_type": eve_type,
                    },
                )
            except ObjectDoesNotExist as exc:
                raise ValueError(
                    f"Solar system with ID {location_id} not found."
                ) from exc
        elif self.model.is_station_id(location_id):
            logger.info(f"Fetching station from ESI with ID {location_id}")
            station = esi.client.Universe.GetUniverseStationsStationId(
                station_id=location_id
            ).result(use_etag=False)

            if station.owner:
                owner = EveEntity.objects.get_or_create_esi(entity_id=station.owner)[0]
            else:
                owner = None

            try:
                solar_system = SolarSystem.objects.get(id=station.system_id)
            except ObjectDoesNotExist as exc:
                raise ValueError(
                    f"Solar system with ID {station.system_id} not found."
                ) from exc

            try:
                eve_type = ItemType.objects.get(id=station.type_id)
            except ObjectDoesNotExist as exc:
                raise ValueError(
                    f"Item type with ID {station.type_id} not found."
                ) from exc

            location, created = self.update_or_create(
                location_id=location_id,
                defaults={
                    "name": station.name,
                    "solar_system": solar_system,
                    "eve_type": eve_type,
                    "owner": owner,
                },
            )
        else:
            location, created = self._structure_update_or_create_esi(
                structure_id=location_id, token=token
            )

        return location, created

    def structure_update_or_create_esi(
        self, structure_id: int, token: Token
    ) -> tuple["LocationContext", bool]:
        # AA Blueprint Forge
        # pylint: disable=import-outside-toplevel
        from bpforge.models.blueprint import EveEntity

        try:
            structure = esi.client.Universe.GetUniverseStructuresStructureId(
                structure_id=structure_id, token=token
            ).result(use_etag=False)
        except HTTPClientError as ex:
            if ex.status_code in [HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN]:
                logger.warning(f"Structure with ID {structure_id} not found.")
                return self.get_or_create(location_id=structure_id)
            raise ex

        try:
            eve_solar_system = SolarSystem.objects.get(id=structure.solar_system_id)
        except ObjectDoesNotExist as exc:
            raise ValueError(
                f"Solar system with ID {structure.solar_system_id} not found."
            ) from exc

        if structure.type_id:
            try:
                eve_type = ItemType.objects.get(id=structure.type_id)
            except ObjectDoesNotExist as exc:
                raise ValueError(
                    f"Type with ID {structure.type_id} not found."
                ) from exc
        else:
            eve_type = None

        owner = EveEntity.objects.get_or_create_esi(entity_id=structure.owner_id)[0]

        return self.update_or_create(
            location_id=structure_id,
            defaults={
                "name": structure.name,
                "solar_system": eve_solar_system,
                "eve_type": eve_type,
                "owner": owner,
            },
        )

    def _structure_update_or_create_esi(
        self, structure_id: int, token: Token
    ) -> tuple["LocationContext", bool]:
        # AA Blueprint Forge
        # pylint: disable=import-outside-toplevel, cyclic-import
        from bpforge.tasks import update_structure_esi

        location, created = self.get_or_create(location_id=structure_id)
        update_structure_esi.apply_async(
            kwargs={"structure_id": structure_id, "token_pk": token.pk}, priority=6
        )
        return location, created


class EveEntityManager(models.Manager["EveEntityContext"]):
    _ESI_INVALID_IDS = [1]

    def get_or_create_esi(self, entity_id: int):
        """
        Get or Create Eve entity object with data fetched from ESI.

        Args:
            entity_id (int): The ID of the entity.
        """

        if entity_id in self._ESI_INVALID_IDS:
            logger.debug(f"Entity with ID {entity_id} is invalid.")
            return None, False

        try:
            response = esi.client.Universe.PostUniverseNames(body=[entity_id]).results(
                use_etag=False
            )
        except HTTPClientError as ex:
            if ex.status_code == HTTPStatus.NOT_FOUND:
                logger.info(f"Entity with ID {entity_id} not found.")
                return None, False
            raise ex

        entity_data = response[0]
        return self.update_or_create(
            eve_id=entity_id,
            defaults={
                "name": entity_data.name,
                "category": entity_data.category,
            },
        )
