"""Tests for Shop, My Blueprints, and Orders API endpoints."""

# Standard Library
from http import HTTPStatus

# Alliance Auth (External Libs)
from eve_sde.models import ItemGroup, ItemType, SolarSystem

# AA Blueprint Forge
from bpforge.models.blueprint import Blueprint, Location, Owner
from bpforge.models.helpers.core import RequestStatus
from bpforge.models.request import Order, Request
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
from bpforge.tests.testdata.factory import (
    EveAllianceInfoFactory,
    EveCharacterFactory,
    EveCorporationInfoFactory,
)


class TestApiShop(AuthTestCase):
    def setUp(self):
        super().setUp()

        # Test Data
        self.solar_system, _ = SolarSystem.objects.get_or_create(
            id=30000142, defaults={"name": "Jita"}
        )
        self.item_group, _ = ItemGroup.objects.get_or_create(
            id=105, defaults={"name": "Frigate Blueprint"}
        )
        self.eve_type, _ = ItemType.objects.get_or_create(
            id=688, defaults={"name": "Rifter Blueprint", "group": self.item_group}
        )

        self.location, _ = Location.objects.get_or_create(
            location_id=60003760,
            defaults={"name": "Jita IV - 4 - Caldari Navy Assembly Plant"},
        )

        # Public Character Owner
        self.char_owner_user = UserMainFactory()
        self.public_owner = Owner.objects.create(
            user=self.char_owner_user,
            character=self.char_owner_user.profile.main_character.character_ownership,
            is_public=True,
        )

        # Private Owner
        self.other_user = UserMainFactory()
        self.private_owner = Owner.objects.create(
            user=self.other_user,
            character=self.other_user.profile.main_character.character_ownership,
            is_public=False,
        )

        # Blueprint for public owner
        self.bpo = Blueprint.objects.create(
            item_id=100001,
            owner=self.public_owner,
            eve_type=self.eve_type,
            location=self.location,
            location_flag="Hangar",
            quantity=1,
            runs=None,
            material_efficency=10,
            time_efficiency=20,
        )

        # Blueprint for private owner
        self.private_bp = Blueprint.objects.create(
            item_id=100002,
            owner=self.private_owner,
            eve_type=self.eve_type,
            location=self.location,
            location_flag="Hangar",
            quantity=1,
            runs=10,
        )

    def test_list_public_shops_should_return_only_public_owners(self):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get("/bpforge/api/blueprints/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        owner_ids = [shop["id"] for shop in data]
        self.assertIn(self.public_owner.id, owner_ids)
        self.assertNotIn(self.private_owner.id, owner_ids)

        shop_entry = next(s for s in data if s["id"] == self.public_owner.id)
        self.assertEqual(shop_entry["blueprint_count"], 1)
        self.assertEqual(shop_entry["bpo_count"], 1)
        self.assertEqual(shop_entry["bpc_count"], 0)

    def test_list_owner_blueprints_should_return_blueprints_for_public_owner(self):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get(f"/bpforge/api/blueprints/{self.public_owner.id}/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["item_id"], self.bpo.item_id)
        self.assertEqual(data[0]["type_name"], "Rifter Blueprint")
        self.assertTrue(data[0]["is_original"])

    def test_list_owner_blueprints_should_deny_access_to_private_owner(self):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get(f"/bpforge/api/blueprints/{self.private_owner.id}/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)

    def test_list_owner_blueprints_should_respect_visibility_settings_even_for_admin(
        self,
    ):
        # Test Data
        self.user.is_superuser = True
        self.user.save()
        self.client.force_login(self.user)

        # 1. Owner offers only copies (BPC), but owner only has BPO
        self.public_owner.public_type = "bpc"
        self.public_owner.save()

        # Test Action
        resp_bpc = self.client.get(f"/bpforge/api/blueprints/{self.public_owner.id}/")

        # Expected Result: 0 blueprints because only BPC is offered
        self.assertEqual(resp_bpc.status_code, HTTPStatus.OK)
        self.assertEqual(len(resp_bpc.json()), 0)

        # 2. Owner offers BPO, but selective_bpo is enabled and is_offered=False
        self.public_owner.public_type = "bpo"
        self.public_owner.selective_bpo_enabled = True
        self.public_owner.save()
        self.bpo.is_offered = False
        self.bpo.save()

        resp_selective_unoffered = self.client.get(
            f"/bpforge/api/blueprints/{self.public_owner.id}/"
        )
        self.assertEqual(resp_selective_unoffered.status_code, HTTPStatus.OK)
        self.assertEqual(len(resp_selective_unoffered.json()), 0)

        # 3. When is_offered=True, BPO appears
        self.bpo.is_offered = True
        self.bpo.save()

        resp_selective_offered = self.client.get(
            f"/bpforge/api/blueprints/{self.public_owner.id}/"
        )
        self.assertEqual(resp_selective_offered.status_code, HTTPStatus.OK)
        self.assertEqual(len(resp_selective_offered.json()), 1)

    def test_list_my_blueprints_should_return_only_current_user_blueprints(self):
        # Test Data
        self.client.force_login(self.char_owner_user)

        # Test Action
        response = self.client.get("/bpforge/api/my-blueprints/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        item_ids = [bp["item_id"] for bp in data]
        self.assertIn(self.bpo.item_id, item_ids)
        self.assertNotIn(self.private_bp.item_id, item_ids)


class TestApiOrders(AuthTestCase):
    def setUp(self):
        super().setUp()

        # Test Data
        self.solar_system, _ = SolarSystem.objects.get_or_create(
            id=30000142, defaults={"name": "Jita"}
        )
        self.item_group, _ = ItemGroup.objects.get_or_create(
            id=105, defaults={"name": "Frigate Blueprint"}
        )
        self.eve_type, _ = ItemType.objects.get_or_create(
            id=688, defaults={"name": "Rifter Blueprint", "group": self.item_group}
        )

        self.location, _ = Location.objects.get_or_create(
            location_id=60003760,
            defaults={"name": "Jita IV - 4 - Caldari Navy Assembly Plant"},
        )

        self.seller_user = UserMainFactory()
        self.seller_owner = Owner.objects.create(
            user=self.seller_user,
            character=self.seller_user.profile.main_character.character_ownership,
            is_public=True,
        )

        self.bp1 = Blueprint.objects.create(
            item_id=200001,
            owner=self.seller_owner,
            eve_type=self.eve_type,
            location=self.location,
            location_flag="Hangar",
            quantity=1,
            runs=None,
            material_efficency=10,
            time_efficiency=20,
        )

        self.bp2 = Blueprint.objects.create(
            item_id=200002,
            owner=self.seller_owner,
            eve_type=self.eve_type,
            location=self.location,
            location_flag="Hangar",
            quantity=5,
            runs=10,
            material_efficency=9,
            time_efficiency=18,
        )

    def test_create_order_should_create_order_with_multiple_items(self):
        # Test Data
        self.client.force_login(self.user)
        payload = {
            "owner_id": self.seller_owner.id,
            "note": "Please deliver to Jita 4-4",
            "items": [
                {"blueprint_id": self.bp1.item_id, "quantity": 2, "runs": 10},
                {"blueprint_id": self.bp2.item_id, "quantity": 1, "runs": 5},
            ],
        }

        # Test Action
        response = self.client.post(
            "/bpforge/api/orders/",
            data=payload,
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.CREATED)
        data = response.json()
        self.assertEqual(data["owner_id"], self.seller_owner.id)
        self.assertEqual(data["status"], RequestStatus.PENDING)
        self.assertEqual(len(data["items"]), 2)

        order = Order.objects.get(id=data["id"])
        self.assertEqual(order.items.count(), 2)

    def test_update_order_status_should_allow_owner_to_accept_and_deliver(self):
        # Test Data
        order = Order.objects.create(
            owner=self.seller_owner,
            requesting_user=self.user,
            status=RequestStatus.PENDING,
            note="Test order",
        )
        Request.objects.create(
            order=order,
            blueprint=self.bp1,
            requesting_user=self.user,
            quantity=1,
            status=RequestStatus.PENDING,
        )

        self.client.force_login(self.seller_user)

        # Test Action - Accept
        response = self.client.post(
            f"/bpforge/api/orders/{order.id}/status/",
            data={"status": RequestStatus.ACCEPTED},
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        order.refresh_from_db()
        self.assertEqual(order.status, RequestStatus.ACCEPTED)

        # Test Action - Deliver
        response = self.client.post(
            f"/bpforge/api/orders/{order.id}/status/",
            data={"status": RequestStatus.DELIVERED},
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        order.refresh_from_db()
        self.assertEqual(order.status, RequestStatus.DELIVERED)
        self.assertIsNotNone(order.closed_at)

    def test_buyer_can_cancel_pending_order(self):
        # Test Data
        order = Order.objects.create(
            owner=self.seller_owner,
            requesting_user=self.user,
            status=RequestStatus.PENDING,
        )
        self.client.force_login(self.user)

        # Test Action
        response = self.client.post(
            f"/bpforge/api/orders/{order.id}/status/",
            data={"status": RequestStatus.CANCELLED},
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        order.refresh_from_db()
        self.assertEqual(order.status, RequestStatus.CANCELLED)
