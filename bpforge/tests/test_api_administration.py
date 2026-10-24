"""Tests for Administration API endpoints and menu."""

# Standard Library
import json
from http import HTTPStatus
from unittest.mock import patch

# Django
from django.contrib.auth.models import Group

# AA Blueprint Forge
from bpforge.models.blueprint import Owner, OwnerPublicType
from bpforge.models.general import GeneralNotificationSettings
from bpforge.models.helpers.update_manager import UpdateSection
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
from bpforge.tests.testdata.bpforge import (
    BlueprintFactory,
    GroupFactory,
    OwnerFactory,
    OwnerUpdateStatusFactory,
)


class TestApiAdministration(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.admin = UserMainFactory(
            permissions__=["bpforge.basic_access", "bpforge.full_access"]
        )
        self.group1 = GroupFactory(name="Industry Managers")
        self.group2 = GroupFactory(name="Production Staff")

        # Create an owner
        self.owner_user = UserMainFactory()
        self.owner = OwnerFactory(
            user=self.owner_user,
            is_public=True,
            public_type=OwnerPublicType.ALL,
        )

    def test_get_menu_should_include_administration_link_for_administrator(self):
        # Test Data
        self.client.force_login(self.admin)

        # Test Action
        response = self.client.get("/bpforge/api/menu/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        right_links = data.get("right_links", [])
        administration_link = next(
            (link for link in right_links if link["name"] == "Administration"), None
        )
        self.assertIsNotNone(administration_link)
        self.assertEqual(administration_link["link"], "/administration/")
        self.assertFalse(administration_link["is_external"])

    def test_get_menu_should_not_include_administration_link_for_normal_user(self):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get("/bpforge/api/menu/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        right_links = data.get("right_links", [])
        administration_link = next(
            (link for link in right_links if link["name"] == "Administration"), None
        )
        self.assertIsNone(administration_link)

    def test_administration_endpoints_should_return_forbidden_for_user_without_permission(
        self,
    ):
        # Test Data
        self.client.force_login(self.user)

        # Test Action & Expected Result
        resp_groups = self.client.get("/bpforge/api/administration/groups/")
        self.assertEqual(resp_groups.status_code, HTTPStatus.FORBIDDEN)

        resp_settings = self.client.get("/bpforge/api/administration/settings/")
        self.assertEqual(resp_settings.status_code, HTTPStatus.FORBIDDEN)

        resp_owners = self.client.get("/bpforge/api/administration/owners/")
        self.assertEqual(resp_owners.status_code, HTTPStatus.FORBIDDEN)

    def test_administration_groups_should_return_all_groups_for_administrator(self):
        # Test Data
        self.client.force_login(self.admin)

        # Test Action
        response = self.client.get("/bpforge/api/administration/groups/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertIsInstance(data, list)
        group_names = [g["name"] for g in data]
        self.assertIn("Industry Managers", group_names)
        self.assertIn("Production Staff", group_names)

    def test_administration_settings_should_get_and_update_global_groups(self):
        # Test Data
        self.client.force_login(self.admin)

        # Test Action - GET
        get_resp = self.client.get("/bpforge/api/administration/settings/")

        # Expected Result - GET
        self.assertEqual(get_resp.status_code, HTTPStatus.OK)
        settings_data = get_resp.json()
        self.assertIn("order_created_group_ids", settings_data)
        self.assertIn("order_status_group_ids", settings_data)

        # Test Action - POST update
        payload = {
            "order_created_group_ids": [self.group1.id],
            "order_status_group_ids": [self.group2.id],
        }
        post_resp = self.client.put(
            "/bpforge/api/administration/settings/",
            data=json.dumps(payload),
            content_type="application/json",
        )

        # Expected Result - POST update
        self.assertEqual(post_resp.status_code, HTTPStatus.OK)
        post_data = post_resp.json()
        self.assertEqual(post_data["order_created_group_ids"], [self.group1.id])
        self.assertEqual(post_data["order_status_group_ids"], [self.group2.id])

        global_settings = GeneralNotificationSettings.get_solo()
        self.assertIn(self.group1, global_settings.order_created_groups.all())
        self.assertIn(self.group2, global_settings.order_status_groups.all())

    def test_administration_owners_should_return_error_message_and_status(self):
        # Test Data
        self.client.force_login(self.admin)
        OwnerUpdateStatusFactory(
            owner=self.owner,
            section=UpdateSection.LOCATIONS,
            is_success=False,
            error_message="Location lookup error",
        )
        healthy_owner = OwnerFactory(user=UserMainFactory())
        OwnerUpdateStatusFactory(
            owner=healthy_owner,
            section=UpdateSection.BLUEPRINTS,
            is_success=True,
        )

        # Test Action
        response = self.client.get("/bpforge/api/administration/owners/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = {entry["id"]: entry for entry in response.json()}
        self.assertEqual(data[self.owner.id]["status"], "error")
        self.assertEqual(data[self.owner.id]["error_message"], "Location lookup error")
        self.assertIsNone(data[healthy_owner.id]["error_message"])

    def test_administration_owners_should_list_and_update_owner_settings(self):
        # Test Data
        self.client.force_login(self.admin)

        # Test Action - GET owners
        get_resp = self.client.get("/bpforge/api/administration/owners/")

        # Expected Result - GET owners
        self.assertEqual(get_resp.status_code, HTTPStatus.OK)
        owners_data = get_resp.json()
        self.assertGreaterEqual(len(owners_data), 1)
        owner_entry = next((o for o in owners_data if o["id"] == self.owner.id), None)
        self.assertIsNotNone(owner_entry)

        # Test Action - POST update owner
        update_payload = {
            "is_public": False,
            "public_type": "bpo",
            "selective_bpo_enabled": True,
            "notify_order_created_group_ids": [self.group1.id],
            "notify_order_status_group_ids": [self.group2.id],
        }
        post_resp = self.client.patch(
            f"/bpforge/api/administration/owners/{self.owner.id}/",
            data=json.dumps(update_payload),
            content_type="application/json",
        )

        # Expected Result - POST update owner
        self.assertEqual(post_resp.status_code, HTTPStatus.OK)
        post_data = post_resp.json()
        self.assertFalse(post_data["is_public"])
        self.assertEqual(post_data["public_type"], "bpo")
        self.assertTrue(post_data["selective_bpo_enabled"])
        self.assertEqual(post_data["notify_order_created_group_ids"], [self.group1.id])
        self.assertEqual(post_data["notify_order_status_group_ids"], [self.group2.id])

        self.owner.refresh_from_db()
        self.assertFalse(self.owner.is_public)
        self.assertEqual(self.owner.public_type, OwnerPublicType.BPO_ONLY)
        self.assertTrue(self.owner.selective_bpo_enabled)
        self.assertIn(self.group1, self.owner.notify_order_created_groups.all())
        self.assertIn(self.group2, self.owner.notify_order_status_groups.all())

    def test_administration_list_owner_blueprints_should_return_all_blueprints_for_administrator(
        self,
    ):
        # Test Data
        self.client.force_login(self.admin)

        bp = BlueprintFactory(
            item_id=300001,
            owner=self.owner,
            eve_type__name="Rifter Blueprint",
            runs=None,
            is_offered=False,
        )

        # Test Action
        response = self.client.get(
            f"/bpforge/api/administration/owners/{self.owner.id}/blueprints/"
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["item_id"], bp.item_id)
        self.assertEqual(data[0]["type_name"], "Rifter Blueprint")

    def test_administration_list_owner_blueprints_should_return_forbidden_for_user_without_permission(
        self,
    ):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get(
            f"/bpforge/api/administration/owners/{self.owner.id}/blueprints/"
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)

    @patch("bpforge.api.administration.update_owner.delay")
    def test_trigger_owner_update_should_queue_task_for_administrator(
        self, mock_update_owner
    ):
        # Test Data
        self.client.force_login(self.admin)

        # Test Action
        response = self.client.post(
            f"/bpforge/api/administration/owners/{self.owner.id}/update/",
            data=json.dumps({}),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("Update task queued", data["message"])
        mock_update_owner.assert_called_once_with(
            owner_pk=self.owner.pk, force_refresh=False
        )

    @patch("bpforge.api.administration.update_owner.delay")
    def test_trigger_owner_update_should_support_force_refresh_for_superuser(
        self, mock_update_owner
    ):
        # Test Data
        self.client.force_login(self.superuser)

        # Test Action
        response = self.client.post(
            f"/bpforge/api/administration/owners/{self.owner.id}/update/",
            data=json.dumps({"force_refresh": True}),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertTrue(data["success"])
        mock_update_owner.assert_called_once_with(
            owner_pk=self.owner.pk, force_refresh=True
        )

    def test_trigger_owner_update_should_return_forbidden_for_user_without_permission(
        self,
    ):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.post(
            f"/bpforge/api/administration/owners/{self.owner.id}/update/",
            data=json.dumps({"force_refresh": False}),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)

    def test_trigger_owner_update_should_return_not_found_on_invalid_owner(self):
        # Test Data
        self.client.force_login(self.admin)

        # Test Action
        response = self.client.post(
            "/bpforge/api/administration/owners/999999/update/",
            data=json.dumps({"force_refresh": False}),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)

    def test_delete_owner_should_delete_owner_for_administrator(self):
        # Test Data
        self.client.force_login(self.admin)
        owner_id = self.owner.id

        # Test Action
        response = self.client.delete(f"/bpforge/api/administration/owners/{owner_id}/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertFalse(Owner.objects.filter(id=owner_id).exists())

    def test_delete_owner_should_return_forbidden_for_user_without_permission(self):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.delete(
            f"/bpforge/api/administration/owners/{self.owner.id}/"
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertTrue(Owner.objects.filter(id=self.owner.id).exists())

    def test_delete_owner_should_return_not_found_on_invalid_owner(self):
        # Test Data
        self.client.force_login(self.admin)

        # Test Action
        response = self.client.delete("/bpforge/api/administration/owners/999999/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)

    @patch("bpforge.api.administration.update_all_blueprints.delay")
    def test_trigger_global_update_should_queue_task_for_administrator(
        self, mock_delay
    ):
        # Test Data
        self.client.force_login(self.superuser)

        # Test Action 1: Target characters with force_refresh
        response_char = self.client.post(
            "/bpforge/api/administration/tasks/queue/",
            data=json.dumps({"target": "characters", "force_refresh": True}),
            content_type="application/json",
        )

        # Expected Result 1
        self.assertEqual(response_char.status_code, HTTPStatus.OK)
        self.assertTrue(response_char.json()["success"])
        mock_delay.assert_called_with(force_refresh=True, target="characters")

        # Test Action 2: Target corporations
        response_corp = self.client.post(
            "/bpforge/api/administration/tasks/queue/",
            data=json.dumps({"target": "corporations", "force_refresh": False}),
            content_type="application/json",
        )

        # Expected Result 2
        self.assertEqual(response_corp.status_code, HTTPStatus.OK)
        mock_delay.assert_called_with(force_refresh=False, target="corporations")

    def test_trigger_global_update_should_return_forbidden_for_user_without_permission(
        self,
    ):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.post(
            "/bpforge/api/administration/tasks/queue/",
            data=json.dumps({"target": "characters", "force_refresh": False}),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)

    def test_trigger_global_update_should_return_forbidden_for_administrator(self):
        # Test Data
        self.client.force_login(self.admin)

        # Test Action
        response = self.client.post(
            "/bpforge/api/administration/tasks/queue/",
            data=json.dumps({"target": "all", "force_refresh": False}),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertEqual(response.json()["error"], "Superuser permission required.")

    @patch("bpforge.api.administration.update_owner.delay")
    def test_trigger_owner_update_should_reject_force_refresh_for_administrator(
        self, mock_update_owner
    ):
        # Test Data
        self.client.force_login(self.admin)

        # Test Action
        response = self.client.post(
            f"/bpforge/api/administration/owners/{self.owner.id}/update/",
            data=json.dumps({"force_refresh": True}),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertEqual(response.json()["error"], "Superuser permission required.")
        mock_update_owner.assert_not_called()

    def test_administration_endpoints_should_allow_superuser(self):
        # Test Data
        self.client.force_login(self.superuser)

        # Test Action
        response = self.client.get("/bpforge/api/administration/owners/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)

    def test_get_user_should_flag_superuser_and_administrator(self):
        # Test Data
        self.client.force_login(self.admin)

        # Test Action
        admin_data = self.client.get("/bpforge/api/user/").json()
        self.client.force_login(self.superuser)
        superuser_data = self.client.get("/bpforge/api/user/").json()

        # Expected Result
        self.assertTrue(admin_data["is_admin"])
        self.assertFalse(admin_data["is_superuser"])
        self.assertTrue(superuser_data["is_superuser"])
