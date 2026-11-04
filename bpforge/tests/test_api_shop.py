"""Tests for Shop, My Blueprints, and Orders API endpoints."""

# Standard Library
from http import HTTPStatus
from importlib import import_module
from unittest.mock import patch

# Django
from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

# Alliance Auth
from allianceauth.groupmanagement.models import Group

# Alliance Auth (External Libs)
from eve_sde.models import ItemGroup, ItemType, SolarSystem

# AA Blueprint Forge
from bpforge.models.blueprint import Blueprint
from bpforge.models.general import GeneralNotificationSettings
from bpforge.models.helpers.core import RequestStatus
from bpforge.models.request import Order, Request
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
from bpforge.tests.testdata.bpforge import (
    BlueprintFactory,
    GroupFactory,
    LocationFactory,
    OrderFactory,
    OwnerFactory,
    RequestFactory,
)
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

        self.location = LocationFactory(
            location_id=60003760,
            name="Jita IV - 4 - Caldari Navy Assembly Plant",
        )

        # Public Character Owner
        self.char_owner_user = UserMainFactory()
        self.public_owner = OwnerFactory(
            user=self.char_owner_user,
            is_public=True,
        )

        # Private Owner
        self.other_user = UserMainFactory()
        self.private_owner = OwnerFactory(
            user=self.other_user,
            is_public=False,
        )

        # Blueprint for public owner
        self.bpo = BlueprintFactory(
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
        self.private_bp = BlueprintFactory(
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

    def test_search_public_blueprints_should_return_matching_items(self):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get("/bpforge/api/blueprints/search/?q=Rifter")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["item_id"], self.bpo.item_id)
        self.assertEqual(data[0]["type_name"], "Rifter Blueprint")
        self.assertEqual(data[0]["owner_id"], self.public_owner.id)

    def test_search_public_blueprints_should_respect_visibility_and_selective_bpo(self):
        # Test Data
        self.client.force_login(self.user)

        # 1. Private owner blueprint should never be returned
        response = self.client.get("/bpforge/api/blueprints/search/?q=Rifter")
        self.assertEqual(response.status_code, HTTPStatus.OK)
        items = response.json()
        owner_ids = [item["owner_id"] for item in items]
        self.assertIn(self.public_owner.id, owner_ids)
        self.assertNotIn(self.private_owner.id, owner_ids)

        # 2. When owner selective_bpo_enabled is True and is_offered is False, item is excluded
        self.public_owner.selective_bpo_enabled = True
        self.public_owner.save()
        self.bpo.is_offered = False
        self.bpo.save()

        response_hidden = self.client.get("/bpforge/api/blueprints/search/?q=Rifter")
        self.assertEqual(response_hidden.status_code, HTTPStatus.OK)
        self.assertEqual(len(response_hidden.json()), 0)

        # 3. When is_offered is True, item appears
        self.bpo.is_offered = True
        self.bpo.save()
        response_shown = self.client.get("/bpforge/api/blueprints/search/?q=Rifter")
        self.assertEqual(response_shown.status_code, HTTPStatus.OK)
        self.assertEqual(len(response_shown.json()), 1)

    def test_search_public_blueprints_should_return_empty_for_blank_query(self):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get("/bpforge/api/blueprints/search/?q=")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json(), [])

    def test_search_public_blueprints_should_deny_access_without_permission(self):
        # Test Data
        no_perm_user = UserMainFactory(permissions__=[])
        self.client.force_login(no_perm_user)

        # Test Action
        response = self.client.get("/bpforge/api/blueprints/search/?q=Rifter")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)

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

        self.location = LocationFactory(
            location_id=60003760,
            name="Jita IV - 4 - Caldari Navy Assembly Plant",
        )

        self.seller_user = UserMainFactory()
        self.seller_owner = OwnerFactory(
            user=self.seller_user,
            is_public=True,
        )

        self.bp1 = BlueprintFactory(
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

        self.bp2 = BlueprintFactory(
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
        order = OrderFactory(
            owner=self.seller_owner,
            requesting_user=self.user,
            status=RequestStatus.PENDING,
            note="Test order",
        )
        RequestFactory(
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

    def _order_with_removed_blueprint(self):
        container = LocationFactory(
            location_id=1050000000001, name="", parent=self.location
        )
        blueprint = BlueprintFactory(
            item_id=200003,
            owner=self.seller_owner,
            eve_type=self.eve_type,
            location=container,
            location_flag="Hangar",
            material_efficency=8,
            time_efficiency=16,
        )
        order = OrderFactory(owner=self.seller_owner, requesting_user=self.user)
        RequestFactory(order=order, blueprint=blueprint, runs=5)
        blueprint.delete()
        return order

    def test_list_orders_should_show_item_of_removed_blueprint_to_seller(self):
        """
        Test should return the copied values for an item whose blueprint is gone.
        """
        # Test Data
        self._order_with_removed_blueprint()
        self.client.force_login(self.seller_user)

        # Test Action
        response = self.client.get("/bpforge/api/orders/", {"role": "seller"})

        # Expected Result
        self.assertEqual(response.status_code, 200)
        item = response.json()[0]["items"][0]
        self.assertFalse(item["blueprint_available"])
        self.assertEqual(item["blueprint_id"], 200003)
        self.assertEqual(item["type_id"], self.eve_type.id)
        self.assertEqual(item["type_name"], "Rifter Blueprint")
        self.assertEqual(item["runs"], 5)
        self.assertEqual(item["material_efficiency"], 8)
        self.assertEqual(item["time_efficiency"], 16)
        self.assertEqual(item["location_name"], self.location.name)

    def test_list_orders_should_hide_location_of_removed_blueprint_from_buyer(self):
        """
        Test should not reveal the copied location to the buyer.
        """
        # Test Data
        self._order_with_removed_blueprint()
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get("/bpforge/api/orders/", {"role": "buyer"})

        # Expected Result
        self.assertEqual(response.status_code, 200)
        item = response.json()[0]["items"][0]
        self.assertFalse(item["blueprint_available"])
        self.assertIsNone(item["location_name"])

    def test_list_orders_should_prefer_current_blueprint_values(self):
        """
        Test should show current values as long as the blueprint exists.
        """
        # Test Data
        order = OrderFactory(owner=self.seller_owner, requesting_user=self.user)
        RequestFactory(order=order, blueprint=self.bp1)
        Blueprint.objects.filter(pk=self.bp1.pk).update(material_efficency=3)
        self.client.force_login(self.seller_user)

        # Test Action
        response = self.client.get("/bpforge/api/orders/", {"role": "seller"})

        # Expected Result
        item = response.json()[0]["items"][0]
        self.assertTrue(item["blueprint_available"])
        self.assertEqual(item["material_efficiency"], 3)

    def test_migration_should_fill_copy_of_existing_order_items(self):
        """
        Test should copy the blueprint values and walk up to the named location.
        """
        # Test Data
        container = LocationFactory(
            location_id=1050000000002, name="", parent=self.location
        )
        self.bp1.location = container
        self.bp1.save()
        item = RequestFactory(
            order=OrderFactory(owner=self.seller_owner, requesting_user=self.user),
            blueprint=self.bp1,
        )
        Request.objects.filter(pk=item.pk).update(
            item_id=0,
            type_id=0,
            type_name="",
            material_efficiency=None,
            location_name="",
        )
        migration = import_module("bpforge.migrations.0006_request_blueprint_copy")

        # Test Action
        migration.fill_blueprint_copy(django_apps, None)

        # Expected Result
        item.refresh_from_db()
        self.assertEqual(item.item_id, 200001)
        self.assertEqual(item.type_id, self.eve_type.id)
        self.assertEqual(item.type_name, "Rifter Blueprint")
        self.assertEqual(item.material_efficiency, 10)
        self.assertEqual(item.time_efficiency, 20)
        self.assertEqual(item.location_name, self.location.name)

    def test_buyer_can_cancel_pending_order(self):
        # Test Data
        order = OrderFactory(
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

    def _create_order_in_container(self):
        """Create an order for a blueprint in an unnamed container inside a station."""
        container = LocationFactory(
            location_id=1000000000001, name="", parent=self.location
        )
        blueprint = BlueprintFactory(
            item_id=200003,
            owner=self.seller_owner,
            eve_type=self.eve_type,
            location=container,
            location_flag="Hangar",
        )
        order = OrderFactory(
            owner=self.seller_owner,
            requesting_user=self.user,
            status=RequestStatus.PENDING,
        )
        RequestFactory(
            order=order,
            blueprint=blueprint,
            requesting_user=self.user,
            status=RequestStatus.PENDING,
        )
        return order

    def test_list_orders_should_show_location_to_seller(self):
        # Test Data
        self._create_order_in_container()
        self.client.force_login(self.seller_user)

        # Test Action
        response = self.client.get("/bpforge/api/orders/?role=seller")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(
            response.json()[0]["items"][0]["location_name"], self.location.name
        )

    def test_list_orders_should_show_location_to_manager(self):
        # Test Data
        self._create_order_in_container()
        global_group = GroupFactory(name="Global Order Managers")
        GeneralNotificationSettings.get_solo().order_created_groups.add(global_group)
        manager_user = UserMainFactory()
        manager_user.groups.add(global_group)
        self.client.force_login(manager_user)

        # Test Action
        response = self.client.get("/bpforge/api/orders/?role=manage")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(
            response.json()[0]["items"][0]["location_name"], self.location.name
        )

    def test_list_orders_should_show_location_to_corp_manager_of_buyer(self):
        # Test Data
        # Django
        from django.contrib.auth.models import Permission

        corp_manager = UserMainFactory()
        corp_manager.user_permissions.add(
            Permission.objects.get(
                content_type__app_label="bpforge", codename="manage_access"
            )
        )
        RequestFactory(
            order=OrderFactory(
                owner=self.seller_owner,
                requesting_user=corp_manager,
                status=RequestStatus.PENDING,
            ),
            blueprint=self.bp1,
        )
        self.client.force_login(corp_manager)

        # Test Action
        manage_response = self.client.get("/bpforge/api/orders/?role=manage")
        buyer_response = self.client.get("/bpforge/api/orders/?role=buyer")

        # Expected Result
        for response in (manage_response, buyer_response):
            self.assertEqual(response.status_code, HTTPStatus.OK)
            self.assertEqual(
                response.json()[0]["items"][0]["location_name"], self.location.name
            )

    def test_list_orders_should_not_query_permissions_per_order(self):
        # Test Data
        def create_order():
            RequestFactory(
                order=OrderFactory(
                    owner=self.seller_owner,
                    requesting_user=self.user,
                    status=RequestStatus.PENDING,
                ),
                blueprint=self.bp1,
            )

        create_order()
        self.client.force_login(self.user)
        # The first request also fills caches of the login session
        self.client.get("/bpforge/api/orders/?role=buyer")
        with CaptureQueriesContext(connection) as one_order:
            self.client.get("/bpforge/api/orders/?role=buyer")
        create_order()
        create_order()

        # Test Action
        with CaptureQueriesContext(connection) as three_orders:
            response = self.client.get("/bpforge/api/orders/?role=buyer")

        # Expected Result
        self.assertEqual(len(response.json()), 3)
        self.assertEqual(len(three_orders), len(one_order))

    def test_list_orders_should_hide_location_from_buyer(self):
        # Test Data
        self._create_order_in_container()
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get("/bpforge/api/orders/?role=buyer")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertIsNone(response.json()[0]["items"][0]["location_name"])

    def test_list_orders_should_hide_location_from_buyer_in_all_role(self):
        # Test Data
        self._create_order_in_container()
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get("/bpforge/api/orders/?role=all")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertIsNone(response.json()[0]["items"][0]["location_name"])

    def test_update_order_status_should_hide_location_from_buyer(self):
        # Test Data
        order = self._create_order_in_container()
        self.client.force_login(self.user)

        # Test Action
        response = self.client.post(
            f"/bpforge/api/orders/{order.id}/status/",
            data={"status": RequestStatus.CANCELLED},
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertIsNone(response.json()["items"][0]["location_name"])

    def test_get_order_should_hide_location_from_buyer(self):
        # Test Data
        order = self._create_order_in_container()
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get(f"/bpforge/api/orders/{order.id}/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertIsNone(response.json()["items"][0]["location_name"])

    def test_list_orders_should_return_empty_location_when_name_is_unknown(self):
        # Test Data
        order = self._create_order_in_container()
        unnamed = LocationFactory(location_id=1000000000002, name="")
        Request.objects.filter(order=order).update(
            blueprint=BlueprintFactory(
                item_id=200004,
                owner=self.seller_owner,
                eve_type=self.eve_type,
                location=unnamed,
                location_flag="Hangar",
            )
        )
        self.client.force_login(self.seller_user)

        # Test Action
        response = self.client.get("/bpforge/api/orders/?role=seller")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json()[0]["items"][0]["location_name"], "")

    def test_list_orders_with_manage_role_should_return_403_for_unauthorized_user(
        self,
    ):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get("/bpforge/api/orders/?role=manage")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)

    def test_list_orders_with_manage_role_should_return_all_orders_for_global_manager(
        self,
    ):
        # Test Data
        global_group = GroupFactory(name="Global Order Managers")
        global_settings = GeneralNotificationSettings.get_solo()
        global_settings.order_created_groups.add(global_group)

        manager_user = UserMainFactory()
        manager_user.groups.add(global_group)

        other_user = UserMainFactory()
        other_owner = OwnerFactory(
            user=other_user,
            is_public=True,
        )
        order1 = OrderFactory(
            owner=self.seller_owner,
            requesting_user=self.user,
            status=RequestStatus.PENDING,
        )
        order2 = OrderFactory(
            owner=other_owner,
            requesting_user=other_user,
            status=RequestStatus.PENDING,
        )

        self.client.force_login(manager_user)

        # Test Action
        response = self.client.get("/bpforge/api/orders/?role=manage")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        order_ids = [o["id"] for o in response.json()]
        self.assertIn(order1.id, order_ids)
        self.assertIn(order2.id, order_ids)

    def test_list_orders_with_manage_role_should_return_only_corp_orders_for_corp_manager(
        self,
    ):
        # Test Data
        # Django
        from django.contrib.auth.models import Permission

        corp_manager = UserMainFactory()
        perm = Permission.objects.get(
            content_type__app_label="bpforge", codename="manage_access"
        )
        corp_manager.user_permissions.add(perm)

        # Order 1: Placed by corp_manager (same corporation)
        order_corp = OrderFactory(
            owner=self.seller_owner,
            requesting_user=corp_manager,
            status=RequestStatus.PENDING,
        )
        # Order 2: Placed by other user with another shop outside corp_manager's corp
        other_user = UserMainFactory()
        other_owner = OwnerFactory(
            user=other_user,
            is_public=True,
        )
        order_other = OrderFactory(
            owner=other_owner,
            requesting_user=other_user,
            status=RequestStatus.PENDING,
        )

        self.client.force_login(corp_manager)

        # Test Action
        response = self.client.get("/bpforge/api/orders/?role=manage")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        order_ids = [o["id"] for o in response.json()]
        self.assertIn(order_corp.id, order_ids)
        self.assertNotIn(order_other.id, order_ids)

    def test_delete_order_should_return_403_for_regular_user(self):
        # Test Data
        order = OrderFactory(
            owner=self.seller_owner,
            requesting_user=self.user,
            status=RequestStatus.PENDING,
        )
        self.client.force_login(self.user)

        # Test Action
        response = self.client.delete(f"/bpforge/api/orders/{order.id}/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertTrue(Order.objects.filter(id=order.id).exists())

    def test_delete_order_should_allow_global_manager_to_delete_order(self):
        # Test Data
        global_group = GroupFactory(name="Global Status Managers")
        global_settings = GeneralNotificationSettings.get_solo()
        global_settings.order_status_groups.add(global_group)

        manager_user = UserMainFactory()
        manager_user.groups.add(global_group)

        order = OrderFactory(
            owner=self.seller_owner,
            requesting_user=self.user,
            status=RequestStatus.PENDING,
        )
        req = RequestFactory(
            order=order,
            blueprint=self.bp1,
            requesting_user=self.user,
            quantity=1,
            status=RequestStatus.PENDING,
        )

        self.client.force_login(manager_user)

        # Test Action
        response = self.client.delete(f"/bpforge/api/orders/{order.id}/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertFalse(Order.objects.filter(id=order.id).exists())
        self.assertFalse(Request.objects.filter(id=req.id).exists())

    def test_delete_order_should_allow_corp_manager_only_for_corp_order(self):
        # Test Data
        # Django
        from django.contrib.auth.models import Permission

        corp_manager = UserMainFactory()
        perm = Permission.objects.get(
            content_type__app_label="bpforge", codename="manage_access"
        )
        corp_manager.user_permissions.add(perm)

        # Order 1: In corp_manager's corp
        order_corp = OrderFactory(
            owner=self.seller_owner,
            requesting_user=corp_manager,
            status=RequestStatus.PENDING,
        )
        # Order 2: Outside corp_manager's corp
        other_user = UserMainFactory()
        other_owner = OwnerFactory(
            user=other_user,
            is_public=True,
        )
        order_other = OrderFactory(
            owner=other_owner,
            requesting_user=other_user,
            status=RequestStatus.PENDING,
        )

        self.client.force_login(corp_manager)

        # Test Action 1: Delete other's order
        response_other = self.client.delete(f"/bpforge/api/orders/{order_other.id}/")

        # Expected Result 1
        self.assertEqual(response_other.status_code, HTTPStatus.FORBIDDEN)
        self.assertTrue(Order.objects.filter(id=order_other.id).exists())

        # Test Action 2: Delete corp's order
        response_corp = self.client.delete(f"/bpforge/api/orders/{order_corp.id}/")

        # Expected Result 2
        self.assertEqual(response_corp.status_code, HTTPStatus.OK)
        self.assertFalse(Order.objects.filter(id=order_corp.id).exists())

    def test_update_order_status_should_allow_manager_to_update_status(self):
        # Test Data
        global_group = GroupFactory(name="Global Status Update Managers")
        global_settings = GeneralNotificationSettings.get_solo()
        global_settings.order_status_groups.add(global_group)

        manager_user = UserMainFactory()
        manager_user.groups.add(global_group)

        order = OrderFactory(
            owner=self.seller_owner,
            requesting_user=self.user,
            status=RequestStatus.PENDING,
        )

        self.client.force_login(manager_user)

        # Test Action
        response = self.client.post(
            f"/bpforge/api/orders/{order.id}/status/",
            data={"status": RequestStatus.ACCEPTED},
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        order.refresh_from_db()
        self.assertEqual(order.status, RequestStatus.ACCEPTED)

    def test_notification_message_should_link_to_manage_for_order_manager(self):
        # Test Data
        # AA Blueprint Forge
        from bpforge.thirdparty.discord import _build_order_notification_message

        global_group = GroupFactory(name="Notification Managers")
        global_settings = GeneralNotificationSettings.get_solo()
        global_settings.order_created_groups.add(global_group)

        manager_user = UserMainFactory()
        manager_user.groups.add(global_group)

        order = OrderFactory(
            owner=self.seller_owner,
            requesting_user=self.user,
            status=RequestStatus.PENDING,
        )

        # Test Action
        msg = _build_order_notification_message(
            order=order,
            base_message="Test message",
            recipient=manager_user,
        )

        # Expected Result
        self.assertIn("?tab=manage", msg)
        self.assertIn("Open Order Management", msg)

    def test_notification_message_should_link_to_buyer_for_requesting_user(self):
        # Test Data
        # AA Blueprint Forge
        from bpforge.thirdparty.discord import _build_order_notification_message

        buyer_user = UserMainFactory()
        order = OrderFactory(
            owner=self.seller_owner,
            requesting_user=buyer_user,
            status=RequestStatus.PENDING,
        )

        # Test Action
        msg = _build_order_notification_message(
            order=order,
            base_message="Test message",
            recipient=buyer_user,
        )

        # Expected Result
        self.assertIn("?tab=buyer", msg)
        self.assertIn("View Order", msg)

    def test_notification_message_should_link_to_seller_for_shop_owner(self):
        # Test Data
        # AA Blueprint Forge
        from bpforge.thirdparty.discord import _build_order_notification_message

        seller_user = self.seller_user
        order = OrderFactory(
            owner=self.seller_owner,
            requesting_user=self.user,
            status=RequestStatus.PENDING,
        )

        # Test Action
        msg = _build_order_notification_message(
            order=order,
            base_message="Test message",
            recipient=seller_user,
        )

        # Expected Result
        self.assertIn("?tab=seller", msg)
        self.assertIn("View Catalog Orders", msg)


class TestOrderHistory(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.eve_type, _ = ItemType.objects.get_or_create(
            id=688,
            defaults={
                "name": "Rifter Blueprint",
                "group": ItemGroup.objects.get_or_create(
                    id=105, defaults={"name": "Frigate Blueprint"}
                )[0],
            },
        )
        self.location = LocationFactory(location_id=60003760, name="Jita IV - 4")
        self.seller_user = UserMainFactory()
        self.seller_owner = OwnerFactory(user=self.seller_user, is_public=True)
        self.seller_name = self.seller_owner.name
        self.blueprint = BlueprintFactory(
            item_id=300001,
            owner=self.seller_owner,
            eve_type=self.eve_type,
            location=self.location,
        )
        self.buyer_name = self.user.profile.main_character.character_name

    def _order(self, status=RequestStatus.PENDING, buyer=None):
        order = OrderFactory(
            owner=self.seller_owner,
            requesting_user=buyer or self.user,
            status=status,
        )
        RequestFactory(order=order, blueprint=self.blueprint, status=status)
        return order

    def _global_manager(self):
        group = GroupFactory(name="Global Order Managers")
        GeneralNotificationSettings.get_solo().order_created_groups.add(group)
        manager = UserMainFactory()
        manager.groups.add(group)
        return manager

    def _list(self, user, role):
        self.client.force_login(user)
        return self.client.get("/bpforge/api/orders/", {"role": role})

    def _ids(self, user, role):
        return [order["id"] for order in self._list(user, role).json()]

    def test_list_orders_should_separate_open_and_closed_orders(self):
        # Test Data
        open_order = self._order(RequestStatus.ACCEPTED)
        closed_order = self._order(RequestStatus.DELIVERED)

        # Test Action & Expected Result
        for role in ("buyer", "all"):
            self.assertEqual(self._ids(self.user, role), [open_order.pk])
        self.assertEqual(self._ids(self.seller_user, "seller"), [open_order.pk])
        self.assertEqual(self._ids(self.user, "history"), [closed_order.pk])
        self.assertEqual(self._ids(self.seller_user, "history"), [closed_order.pk])

    def test_history_should_not_show_orders_of_other_users(self):
        # Test Data
        self._order(RequestStatus.DELIVERED)

        # Test Action & Expected Result
        self.assertEqual(self._ids(UserMainFactory(), "history"), [])

    @patch("bpforge.signals.notify_order_cancelled_by_shop_removal")
    def test_deleting_owner_should_keep_orders_in_history(self, mock_notify):
        # Test Data
        open_order = self._order(RequestStatus.PENDING)
        delivered_order = self._order(RequestStatus.DELIVERED)
        closed_at = timezone.now()
        Order.objects.filter(pk=delivered_order.pk).update(closed_at=closed_at)

        # Test Action
        self.seller_owner.delete()

        # Expected Result
        open_order.refresh_from_db()
        delivered_order.refresh_from_db()
        self.assertIsNone(open_order.owner)
        self.assertEqual(open_order.status, RequestStatus.CANCELLED)
        self.assertIsNotNone(open_order.closed_at)
        self.assertEqual(open_order.items.get().status, RequestStatus.CANCELLED)
        self.assertEqual(delivered_order.status, RequestStatus.DELIVERED)
        self.assertEqual(delivered_order.closed_at, closed_at)
        self.assertEqual(delivered_order.items.count(), 1)
        mock_notify.assert_called_once()
        self.assertEqual(mock_notify.call_args.args[0].pk, open_order.pk)

        for user in (self.user, self.seller_user):
            response = self._list(user, "history")
            self.assertEqual(response.status_code, 200)
            data = {order["id"]: order for order in response.json()}
            self.assertEqual(set(data), {open_order.pk, delivered_order.pk})
            self.assertIsNone(data[open_order.pk]["owner_id"])
            self.assertEqual(data[open_order.pk]["owner_name"], self.seller_name)
            self.assertEqual(
                data[open_order.pk]["items"][0]["type_name"], "Rifter Blueprint"
            )

    @patch("bpforge.signals.notify_order_cancelled_by_shop_removal")
    def test_deleting_owner_should_not_notify_about_own_orders(self, mock_notify):
        # Test Data
        self._order(RequestStatus.PENDING, buyer=self.seller_user)

        # Test Action
        self.seller_owner.delete()

        # Expected Result
        mock_notify.assert_not_called()

    def test_deleting_owner_should_notify_buyer(self):
        # Test Data
        order = self._order(RequestStatus.PENDING)

        # Test Action
        with patch("bpforge.thirdparty.discord.send_user_notification") as mock_send:
            self.seller_owner.delete()

        # Expected Result
        mock_send.assert_called_once()
        self.assertEqual(mock_send.call_args.kwargs["user_id"], self.user.pk)
        self.assertIn(f"#{order.pk}", mock_send.call_args.kwargs["message"])
        self.assertIn(self.seller_name, mock_send.call_args.kwargs["message"])

    @patch("bpforge.signals.notify_order_cancelled_by_shop_removal")
    def test_deleting_seller_user_should_keep_orders(self, mock_notify):
        # Test Data
        order = self._order(RequestStatus.ACCEPTED)

        # Test Action
        self.seller_user.delete()

        # Expected Result
        order.refresh_from_db()
        self.assertIsNone(order.owner)
        self.assertIsNone(order.seller_user)
        self.assertEqual(order.status, RequestStatus.CANCELLED)
        self.assertEqual(order.owner_name, self.seller_name)
        mock_notify.assert_called_once()

    def test_deleting_buyer_should_keep_order_for_seller(self):
        # Test Data
        buyer = UserMainFactory()
        buyer_name = buyer.profile.main_character.character_name
        order = self._order(RequestStatus.PENDING, buyer=buyer)

        # Test Action
        buyer.delete()

        # Expected Result
        order.refresh_from_db()
        self.assertEqual(order.status, RequestStatus.CANCELLED)
        response = self._list(self.seller_user, "history")
        data = response.json()[0]
        self.assertEqual(data["id"], order.pk)
        self.assertIsNone(data["requesting_user_id"])
        self.assertEqual(data["requesting_user_name"], buyer_name)
        self.assertEqual(data["owner_id"], self.seller_owner.pk)

    def test_deleting_buyer_through_django_user_model_should_cancel_order(self):
        # Test Data
        buyer = UserMainFactory()
        order = self._order(RequestStatus.PENDING, buyer=buyer)

        # Test Action
        get_user_model().objects.get(pk=buyer.pk).delete()

        # Expected Result
        order.refresh_from_db()
        self.assertIsNone(order.requesting_user)
        self.assertEqual(order.status, RequestStatus.CANCELLED)

    @patch("bpforge.signals.notify_order_cancelled_by_shop_removal")
    def test_deleting_corporation_should_keep_orders_of_corporation_shop(self, _):
        # Test Data
        corporation = EveCorporationInfoFactory()
        self.seller_owner.corporation = corporation
        self.seller_owner.save()
        order = self._order(RequestStatus.PENDING)

        # Test Action
        corporation.delete()

        # Expected Result
        order.refresh_from_db()
        self.assertIsNone(order.owner)
        self.assertEqual(order.status, RequestStatus.CANCELLED)
        self.assertEqual(order.owner_name, corporation.corporation_name)

    def test_removing_character_ownership_should_keep_owner_and_order(self):
        # Test Data
        order = self._order(RequestStatus.PENDING)

        # Test Action
        self.seller_owner.character.delete()

        # Expected Result
        order.refresh_from_db()
        self.seller_owner.refresh_from_db()
        self.assertIsNone(self.seller_owner.character)
        self.assertEqual(order.owner, self.seller_owner)
        self.assertEqual(order.status, RequestStatus.PENDING)

    @patch("bpforge.signals.notify_order_cancelled_by_shop_removal")
    def test_update_status_should_reject_order_of_deleted_shop(self, _):
        # Test Data
        order = self._order(RequestStatus.PENDING)
        self.seller_owner.delete()
        manager = self._global_manager()
        self.client.force_login(manager)

        # Test Action
        response = self.client.post(
            f"/bpforge/api/orders/{order.pk}/status/",
            data={"status": RequestStatus.ACCEPTED},
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        order.refresh_from_db()
        self.assertEqual(order.status, RequestStatus.CANCELLED)

    @patch("bpforge.signals.notify_order_cancelled_by_shop_removal")
    def test_global_manager_should_see_all_of_history(self, _):
        # Test Data
        order = self._order(RequestStatus.PENDING)
        self.seller_owner.delete()
        manager = self._global_manager()

        # Test Action & Expected Result
        self.assertEqual(self._ids(manager, "history"), [order.pk])

    @patch("bpforge.signals.notify_order_cancelled_by_shop_removal")
    def test_corp_manager_should_see_order_of_deleted_shop_of_own_corporation(self, _):
        # Test Data
        order = self._order(RequestStatus.PENDING)
        corporation_id = self.seller_owner.corporation_id_of_shop
        self.seller_owner.delete()
        other_order = OrderFactory(
            owner=None,
            requesting_user=None,
            status=RequestStatus.DELIVERED,
            owner_corporation_id=corporation_id + 1,
        )
        manager = UserMainFactory()
        manager.user_permissions.add(
            Permission.objects.get(
                content_type__app_label="bpforge", codename="manage_access"
            )
        )
        Order.objects.filter(pk=order.pk).update(
            owner_corporation_id=manager.profile.main_character.corporation_id
        )
        Order.objects.filter(pk=other_order.pk).update(
            owner_corporation_id=manager.profile.main_character.corporation_id + 1
        )

        # Test Action & Expected Result
        self.assertEqual(self._ids(manager, "history"), [order.pk])
        self.client.force_login(manager)
        response = self.client.get(f"/bpforge/api/orders/{order.pk}/")
        self.assertEqual(response.status_code, 200)
        response = self.client.get(f"/bpforge/api/orders/{other_order.pk}/")
        self.assertEqual(response.status_code, 403)

    def test_migration_should_fill_copy_of_existing_orders(self):
        # Test Data
        order = self._order(RequestStatus.PENDING)
        expected_corporation_id = self.seller_owner.corporation_id_of_shop
        Order.objects.filter(pk=order.pk).update(
            owner_name="",
            requesting_user_name="",
            seller_user=None,
            owner_corporation_id=None,
        )
        migration = import_module("bpforge.migrations.0007_order_history")

        # Test Action
        migration.fill_order_copy(django_apps, None)

        # Expected Result
        order.refresh_from_db()
        self.assertEqual(order.owner_name, self.seller_name)
        self.assertEqual(order.requesting_user_name, self.buyer_name)
        self.assertEqual(order.seller_user, self.seller_user)
        self.assertEqual(order.owner_corporation_id, expected_corporation_id)
