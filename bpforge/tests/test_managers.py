"""Tests for BlueprintManager and blueprint uniqueness and deletion."""

# Third Party
from evesde_factory.eve_sde import ItemTypeFactory

# Django
from django.db import IntegrityError

# AA Blueprint Forge
from bpforge.models.blueprint import Blueprint
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.bpforge import (
    BlueprintFactory,
    EsiBlueprintItemData,
    LocationFactory,
    OwnerFactory,
)


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
