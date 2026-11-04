"""Tests for BlueprintManager, LocationManager and blueprint uniqueness and deletion."""

# Standard Library
from unittest.mock import patch

# Third Party
import pook
from evesde_factory.eve_sde import ItemTypeFactory, SolarSystemFactory

# Django
from django.db import IntegrityError

# AA Blueprint Forge
from bpforge.models.blueprint import Blueprint, Location, Owner
from bpforge.models.request import Order
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.bpforge import (
    BlueprintFactory,
    EsiBlueprintItemData,
    LocationFactory,
    OrderFactory,
    OwnerFactory,
    RequestFactory,
)
from bpforge.tests.testdata.utils import add_new_token

ESI_URL = "https://esi.evetech.net"
UPDATE_STRUCTURE_TASK = "bpforge.tasks.update_structure_esi.apply_async"
STRUCTURE_ID = 1049854533347
CONTAINER_ID = 1050000000001
STATION_ID = 60003466


class BlueprintManagerTestCase(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.owner1 = OwnerFactory(user=self.user)
        self.owner2 = OwnerFactory()
        self.location = LocationFactory()
        self.item_type = ItemTypeFactory()

    def test_create_blueprints_with_same_item_id_for_different_owners_should_succeed(
        self,
    ):
        # Test Data
        item_id = 999999

        # Test Action
        bp1 = BlueprintFactory(
            item_id=item_id,
            owner=self.owner1,
            eve_type=self.item_type,
            location=self.location,
        )
        bp2 = BlueprintFactory(
            item_id=item_id,
            owner=self.owner2,
            eve_type=self.item_type,
            location=self.location,
        )

        # Expected Result
        self.assertNotEqual(bp1.pk, bp2.pk)
        self.assertEqual(bp1.item_id, bp2.item_id)
        self.assertEqual(Blueprint.objects.filter(item_id=item_id).count(), 2)

    def test_create_blueprints_with_same_item_id_for_same_owner_should_raise_integrity_error(
        self,
    ):
        # Test Data
        item_id = 888888
        BlueprintFactory(
            item_id=item_id,
            owner=self.owner1,
            eve_type=self.item_type,
            location=self.location,
        )

        # Test Action & Expected Result
        with self.assertRaises(IntegrityError):
            BlueprintFactory(
                item_id=item_id,
                owner=self.owner1,
                eve_type=self.item_type,
                location=self.location,
                location_flag="Hangar",
                quantity=1,
            )

    def test_update_or_create_objs_should_allow_same_item_id_for_different_owners(self):
        # Test Data
        esi_item = EsiBlueprintItemData(
            item_id=777777,
            type_id=self.item_type.id,
            location_id=self.location.location_id,
            location_flag="Hangar",
            quantity=1,
            runs=10,
            material_efficiency=8,
            time_efficiency=16,
        )

        # Test Action
        Blueprint.objects._update_or_create_objs(owner=self.owner1, objs=[esi_item])
        Blueprint.objects._update_or_create_objs(owner=self.owner2, objs=[esi_item])

        # Expected Result
        bp_owner1 = Blueprint.objects.filter(owner=self.owner1, item_id=777777).first()
        bp_owner2 = Blueprint.objects.filter(owner=self.owner2, item_id=777777).first()
        self.assertIsNotNone(bp_owner1)
        self.assertIsNotNone(bp_owner2)
        self.assertNotEqual(bp_owner1.pk, bp_owner2.pk)
        self.assertEqual(bp_owner1.item_id, bp_owner2.item_id)

    def test_update_or_create_objs_should_update_existing_blueprint_attributes(self):
        # Test Data
        bp = BlueprintFactory(
            item_id=666666,
            owner=self.owner1,
            eve_type=self.item_type,
            location=self.location,
            runs=5,
            material_efficency=2,
            time_efficiency=4,
        )
        original_pk = bp.pk

        esi_item = EsiBlueprintItemData(
            item_id=666666,
            type_id=self.item_type.id,
            location_id=self.location.location_id,
            location_flag="Hangar",
            quantity=1,
            runs=10,
            material_efficiency=10,
            time_efficiency=20,
        )

        # Test Action
        Blueprint.objects._update_or_create_objs(owner=self.owner1, objs=[esi_item])

        # Expected Result
        bp.refresh_from_db()
        self.assertEqual(bp.pk, original_pk)
        self.assertEqual(bp.runs, 10)
        self.assertEqual(bp.material_efficency, 10)
        self.assertEqual(bp.time_efficiency, 20)

    def test_update_or_create_objs_should_deduplicate_incoming_items_with_same_item_id(
        self,
    ):
        # Test Data
        item1 = EsiBlueprintItemData(
            item_id=555555,
            type_id=self.item_type.id,
            location_id=self.location.location_id,
            location_flag="Hangar",
            quantity=1,
            runs=10,
            material_efficiency=10,
            time_efficiency=20,
        )
        item2 = EsiBlueprintItemData(
            item_id=555555,
            type_id=self.item_type.id,
            location_id=self.location.location_id,
            location_flag="Hangar",
            quantity=1,
            runs=10,
            material_efficiency=10,
            time_efficiency=20,
        )

        # Test Action
        Blueprint.objects._update_or_create_objs(owner=self.owner1, objs=[item1, item2])

        # Expected Result
        self.assertEqual(
            Blueprint.objects.filter(owner=self.owner1, item_id=555555).count(), 1
        )

    def test_update_or_create_objs_should_delete_blueprints_no_longer_present_in_esi(
        self,
    ):
        # Test Data
        bp_kept = BlueprintFactory(
            item_id=444111,
            owner=self.owner1,
            eve_type=self.item_type,
            location=self.location,
        )
        bp_removed = BlueprintFactory(
            item_id=444222,
            owner=self.owner1,
            eve_type=self.item_type,
            location=self.location,
        )
        # Other owner's blueprint should not be affected
        bp_other_owner = BlueprintFactory(
            item_id=444333,
            owner=self.owner2,
            eve_type=self.item_type,
            location=self.location,
        )

        esi_item = EsiBlueprintItemData(
            item_id=444111,
            type_id=self.item_type.id,
            location_id=self.location.location_id,
            location_flag="Hangar",
        )

        # Test Action
        Blueprint.objects._update_or_create_objs(owner=self.owner1, objs=[esi_item])

        # Expected Result
        self.assertTrue(
            Blueprint.objects.filter(
                owner=self.owner1, item_id=bp_kept.item_id
            ).exists()
        )
        self.assertFalse(
            Blueprint.objects.filter(
                owner=self.owner1, item_id=bp_removed.item_id
            ).exists()
        )
        self.assertTrue(
            Blueprint.objects.filter(
                owner=self.owner2, item_id=bp_other_owner.item_id
            ).exists()
        )

    def test_update_or_create_objs_should_delete_all_blueprints_when_objs_is_empty(
        self,
    ):
        # Test Data
        BlueprintFactory(
            item_id=333111,
            owner=self.owner1,
            eve_type=self.item_type,
            location=self.location,
        )
        BlueprintFactory(
            item_id=333222,
            owner=self.owner1,
            eve_type=self.item_type,
            location=self.location,
        )
        bp_other = BlueprintFactory(
            item_id=333333,
            owner=self.owner2,
            eve_type=self.item_type,
            location=self.location,
        )

        # Test Action
        Blueprint.objects._update_or_create_objs(owner=self.owner1, objs=[])

        # Expected Result
        self.assertEqual(Blueprint.objects.filter(owner=self.owner1).count(), 0)
        self.assertEqual(
            Blueprint.objects.filter(
                owner=self.owner2, item_id=bp_other.item_id
            ).count(),
            1,
        )


class BlueprintRemovalOrderItemTestCase(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.owner = OwnerFactory(user=self.user)
        self.character = self.owner.character.character
        add_new_token(self.user, self.character, Owner.get_character_scopes())
        self.item_type = ItemTypeFactory(name="Rifter Blueprint")
        self.location = LocationFactory()
        self.blueprint = BlueprintFactory(
            item_id=555111,
            owner=self.owner,
            eve_type=self.item_type,
            location=self.location,
        )
        self.item = RequestFactory(
            order=OrderFactory(owner=self.owner),
            blueprint=self.blueprint,
        )

    def _mock_blueprints(self, blueprints: list[dict]):
        pook.get(
            f"{ESI_URL}/characters/{self.character.character_id}/blueprints",
            reply=200,
            response_json=blueprints,
        )

    @pook.on
    def test_update_blueprints_should_keep_order_item_when_esi_drops_blueprint(self):
        # Test Data
        self._mock_blueprints([])

        # Test Action
        Blueprint.objects.update_or_create_blueprints(self.owner)

        # Expected Result
        self.assertFalse(Blueprint.objects.filter(item_id=555111).exists())
        self.item.refresh_from_db()
        self.assertIsNone(self.item.blueprint)
        self.assertEqual(self.item.item_id, 555111)
        self.assertEqual(self.item.type_name, "Rifter Blueprint")
        self.assertTrue(Order.objects.filter(pk=self.item.order_id).exists())


class LocationManagerTestCase(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.owner = OwnerFactory(user=self.user)
        self.character = self.owner.character.character
        add_new_token(self.user, self.character, Owner.get_character_scopes())
        self.item_type = ItemTypeFactory()

    def _mock_assets(self, assets: list[dict]):
        pook.get(
            f"{ESI_URL}/characters/{self.character.character_id}/assets",
            reply=200,
            response_json=assets,
        )

    def _asset(self, item_id: int, location_id: int, location_type: str = "item"):
        return {
            "is_singleton": True,
            "item_id": item_id,
            "location_flag": "Hangar",
            "location_id": location_id,
            "location_type": location_type,
            "quantity": 1,
            "type_id": self.item_type.id,
        }

    def _blueprint_in(self, location_id: int):
        return BlueprintFactory(
            owner=self.owner,
            eve_type=self.item_type,
            location=LocationFactory(location_id=location_id, name=""),
        )

    @pook.on
    @patch(UPDATE_STRUCTURE_TASK)
    def test_update_locations_should_resolve_structure_of_blueprint_in_hangar(
        self, mock_task
    ):
        # Test Data
        blueprint = self._blueprint_in(STRUCTURE_ID)
        self._mock_assets([self._asset(blueprint.item_id, STRUCTURE_ID)])

        # Test Action
        Location.objects.update_or_create_locations(self.owner)

        # Expected Result
        mock_task.assert_called_once()
        self.assertEqual(
            mock_task.call_args.kwargs["kwargs"]["structure_id"], STRUCTURE_ID
        )

    @pook.on
    def test_update_locations_should_name_existing_station_of_blueprint_in_hangar(self):
        # Test Data
        blueprint = self._blueprint_in(STATION_ID)
        solar_system = SolarSystemFactory()
        self._mock_assets([self._asset(blueprint.item_id, STATION_ID, "station")])
        pook.get(
            f"{ESI_URL}/universe/stations/{STATION_ID}",
            reply=200,
            response_json={
                "max_dockable_ship_volume": 50000000.0,
                "name": "Test Station",
                "office_rental_cost": 10000.0,
                "owner": 1000035,
                "position": {"x": 1.0, "y": 2.0, "z": 3.0},
                "race_id": 1,
                "reprocessing_efficiency": 0.5,
                "reprocessing_stations_take": 0.05,
                "services": ["factory"],
                "station_id": STATION_ID,
                "system_id": solar_system.id,
                "type_id": self.item_type.id,
            },
        )
        pook.post(
            f"{ESI_URL}/universe/names",
            reply=200,
            response_json=[
                {"category": "corporation", "id": 1000035, "name": "Test Corp"}
            ],
        )

        # Test Action
        Location.objects.update_or_create_locations(self.owner)

        # Expected Result
        location = Location.objects.get(location_id=STATION_ID)
        self.assertEqual(location.name, "Test Station")
        self.assertEqual(location.solar_system, solar_system)

    @pook.on
    @patch(UPDATE_STRUCTURE_TASK)
    def test_update_locations_should_not_resolve_location_without_blueprints(
        self, mock_task
    ):
        # Test Data
        self._mock_assets([self._asset(1050000000002, STRUCTURE_ID)])

        # Test Action
        Location.objects.update_or_create_locations(self.owner)

        # Expected Result
        mock_task.assert_not_called()
        self.assertFalse(Location.objects.filter(location_id=STRUCTURE_ID).exists())

    @pook.on
    @patch(UPDATE_STRUCTURE_TASK)
    def test_update_locations_should_not_resolve_container_as_structure(
        self, mock_task
    ):
        # Test Data
        in_container = self._blueprint_in(CONTAINER_ID)
        in_hangar = self._blueprint_in(STRUCTURE_ID)
        self._mock_assets(
            [
                self._asset(CONTAINER_ID, STRUCTURE_ID),
                self._asset(in_container.item_id, CONTAINER_ID),
                self._asset(in_hangar.item_id, STRUCTURE_ID),
            ]
        )

        # Test Action
        Location.objects.update_or_create_locations(self.owner)

        # Expected Result
        mock_task.assert_called_once()
        self.assertEqual(
            mock_task.call_args.kwargs["kwargs"]["structure_id"], STRUCTURE_ID
        )
        container = Location.objects.get(location_id=CONTAINER_ID)
        self.assertEqual(container.parent_id, STRUCTURE_ID)

    @pook.on
    def test_structure_update_should_store_name_from_esi(self):
        # Test Data
        solar_system = SolarSystemFactory()
        pook.get(
            f"{ESI_URL}/universe/structures/{STRUCTURE_ID}",
            reply=200,
            response_json={
                "name": "Test Structure",
                "owner_id": 1000035,
                "position": {"x": 1.0, "y": 2.0, "z": 3.0},
                "solar_system_id": solar_system.id,
                "type_id": self.item_type.id,
            },
        )
        pook.post(
            f"{ESI_URL}/universe/names",
            reply=200,
            response_json=[
                {"category": "corporation", "id": 1000035, "name": "Test Corp"}
            ],
        )

        # Test Action
        location, _ = Location.objects.structure_update_or_create_esi(
            structure_id=STRUCTURE_ID, token=self.owner.token
        )

        # Expected Result
        self.assertEqual(location.name, "Test Structure")

    @pook.on
    def test_structure_update_should_keep_empty_name_when_esi_denies_access(self):
        # Test Data
        pook.get(
            f"{ESI_URL}/universe/structures/{STRUCTURE_ID}",
            reply=403,
            response_json={"error": "Forbidden"},
        )

        # Test Action
        location, _ = Location.objects.structure_update_or_create_esi(
            structure_id=STRUCTURE_ID, token=self.owner.token
        )

        # Expected Result
        self.assertEqual(location.name, "")
        self.assertEqual(location.location_id, STRUCTURE_ID)
