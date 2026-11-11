# Standard Library
import json
from http import HTTPStatus
from unittest.mock import patch

# Third Party
from evesde_factory.allianceauth import EveCharacterFactory
from evesde_factory.utils import add_character_to_user

# Django
from django.urls import reverse

# AA Blueprint Forge
from bpforge.models.blueprint import Owner
from bpforge.models.helpers.update_manager import OwnerUpdateSection
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
from bpforge.tests.testdata.bpforge import (
    BlueprintFactory,
    LocationFactory,
    OrderFactory,
    OwnerFactory,
    OwnerUpdateStatusFactory,
)


class TestApiGeneral(AuthTestCase):
    def test_get_menu_should_return_menu_with_right_links(self):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get("/bpforge/api/menu/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertIn("left_links", data)
        self.assertIn("right_links", data)

        left_links = data["left_links"]
        overview_link = next(item for item in left_links if item["name"] == "Overview")
        self.assertEqual(overview_link["link"], "/")

        right_links = data["right_links"]
        right_link_names = [item["name"] for item in right_links]
        self.assertIn("Add Character", right_link_names)
        self.assertIn("Add Corporation", right_link_names)

        add_char = next(item for item in right_links if item["name"] == "Add Character")
        self.assertEqual(add_char["link"], reverse("bpforge:add_character"))
        self.assertTrue(add_char["is_external"])

        add_corp = next(
            item for item in right_links if item["name"] == "Add Corporation"
        )
        self.assertEqual(add_corp["link"], reverse("bpforge:add_corporation"))
        self.assertTrue(add_corp["is_external"])

    def test_get_menu_should_not_show_badges_without_open_orders_and_issues(self):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get("/bpforge/api/menu/")

        # Expected Result
        links = {item["name"]: item for item in response.json()["left_links"]}
        self.assertIsNone(links["Orders"]["badge"])
        self.assertFalse(links["Orders"]["has_errors"])
        self.assertIsNone(links["Settings"]["badge"])
        self.assertFalse(links["Settings"]["has_errors"])

    def test_get_menu_should_count_open_seller_orders_in_orders_badge(self):
        # Test Data
        owner = OwnerFactory(user=self.user)
        OrderFactory(owner=owner, status="Pending")
        OrderFactory(owner=owner, status="Accepted")
        OrderFactory(owner=owner, status="Completed")
        OrderFactory(owner=OwnerFactory(), status="Pending")
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get("/bpforge/api/menu/")

        # Expected Result
        links = {item["name"]: item for item in response.json()["left_links"]}
        self.assertEqual(links["Orders"]["badge"], 2)
        self.assertTrue(links["Orders"]["has_errors"])

    def test_get_menu_should_count_owners_with_errors_in_settings_badge(self):
        # Test Data
        failing = OwnerFactory(user=self.user)
        OwnerUpdateStatusFactory(
            owner=failing, section=OwnerUpdateSection.BLUEPRINTS, is_success=False
        )
        OwnerUpdateStatusFactory(
            owner=failing, section=OwnerUpdateSection.LOCATIONS, is_success=False
        )
        healthy = OwnerFactory(user=self.user)
        OwnerUpdateStatusFactory(
            owner=healthy, section=OwnerUpdateSection.BLUEPRINTS, is_success=True
        )
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get("/bpforge/api/menu/")

        # Expected Result
        links = {item["name"]: item for item in response.json()["left_links"]}
        self.assertEqual(links["Settings"]["badge"], 1)
        self.assertTrue(links["Settings"]["has_errors"])

    def test_get_user_owners_should_return_only_current_user_owners(self):
        # Test Data
        self.client.force_login(self.user)
        owner_self = OwnerFactory(user=self.user, is_public=False)
        other_user = UserMainFactory()
        owner_other = OwnerFactory(user=other_user, is_public=True)

        # Test Action
        response = self.client.get("/bpforge/api/settings/owners/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        owner_ids = [item["id"] for item in data]
        self.assertIn(owner_self.id, owner_ids)
        self.assertNotIn(owner_other.id, owner_ids)

    def test_update_owner_setting_should_toggle_is_public(self):
        # Test Data
        self.client.force_login(self.user)
        owner = OwnerFactory(user=self.user, is_public=False)

        # Test Action
        response = self.client.patch(
            f"/bpforge/api/settings/owners/{owner.id}/",
            data=json.dumps({"is_public": True}),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        owner.refresh_from_db()
        self.assertTrue(owner.is_public)
        self.assertTrue(response.json()["is_public"])

    def test_update_owner_setting_should_return_forbidden_for_other_user(self):
        # Test Data
        self.client.force_login(self.user)
        other_user = UserMainFactory()
        owner_other = OwnerFactory(user=other_user, is_public=False)

        # Test Action
        response = self.client.patch(
            f"/bpforge/api/settings/owners/{owner_other.id}/",
            data=json.dumps({"is_public": True}),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        owner_other.refresh_from_db()
        self.assertFalse(owner_other.is_public)

    def test_update_owner_setting_should_update_public_type_and_selective_bpo(self):
        # Test Data
        self.client.force_login(self.user)
        owner = OwnerFactory(
            user=self.user,
            is_public=True,
            public_type="all",
            selective_bpo_enabled=False,
        )

        # Test Action
        response = self.client.patch(
            f"/bpforge/api/settings/owners/{owner.id}/",
            data=json.dumps(
                {
                    "public_type": "bpo",
                    "selective_bpo_enabled": True,
                }
            ),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        owner.refresh_from_db()
        self.assertEqual(owner.public_type, "bpo")
        self.assertTrue(owner.selective_bpo_enabled)

    def test_get_and_update_owner_bpos_should_return_and_set_offered_status(self):
        # Test Data
        self.client.force_login(self.user)
        owner = OwnerFactory(user=self.user, is_public=True)

        bp1 = BlueprintFactory(
            item_id=200001,
            owner=owner,
            eve_type__name="Rifter Blueprint",
            runs=None,
            is_offered=False,
        )
        bp2 = BlueprintFactory(
            item_id=200002,
            owner=owner,
            eve_type__name="Breacher Blueprint",
            runs=None,
            is_offered=True,
            location=bp1.location,
        )
        # BPC (runs > 0) should not appear in BPO endpoint
        BlueprintFactory(
            item_id=200003,
            owner=owner,
            eve_type=bp1.eve_type,
            location=bp1.location,
            runs=10,
            is_offered=True,
        )

        # Test Action - GET
        get_resp = self.client.get(f"/bpforge/api/settings/owners/{owner.id}/bpos/")

        # Expected Result - GET
        self.assertEqual(get_resp.status_code, HTTPStatus.OK)
        bpo_list = get_resp.json()
        self.assertEqual(len(bpo_list), 2)
        bpo_item_ids = [b["item_id"] for b in bpo_list]
        self.assertIn(bp1.item_id, bpo_item_ids)
        self.assertIn(bp2.item_id, bpo_item_ids)

        # Test Action - POST update
        post_resp = self.client.post(
            f"/bpforge/api/settings/owners/{owner.id}/bpos/",
            data=json.dumps({"offered_item_ids": [bp1.item_id]}),
            content_type="application/json",
        )

        # Expected Result - POST update
        self.assertEqual(post_resp.status_code, HTTPStatus.OK)
        bp1.refresh_from_db()
        bp2.refresh_from_db()
        self.assertTrue(bp1.is_offered)
        self.assertFalse(bp2.is_offered)

    def test_get_owner_bpos_should_return_station_name_for_nested_locations(self):
        # Test Data
        self.client.force_login(self.user)
        owner = OwnerFactory(user=self.user, is_public=True)
        structure = LocationFactory(location_id=1000000000001, name="Sotiyo")
        office = LocationFactory(location_id=1000000000002, name="", parent=structure)
        container = LocationFactory(location_id=1000000000003, name="", parent=office)
        unresolved = LocationFactory(location_id=1000000000004, name="")

        BlueprintFactory(item_id=200011, owner=owner, runs=None, location=structure)
        BlueprintFactory(item_id=200012, owner=owner, runs=None, location=office)
        BlueprintFactory(item_id=200013, owner=owner, runs=None, location=container)
        BlueprintFactory(item_id=200014, owner=owner, runs=None, location=unresolved)

        # Test Action
        response = self.client.get(f"/bpforge/api/settings/owners/{owner.id}/bpos/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        names = {bp["item_id"]: bp["location_name"] for bp in response.json()}
        self.assertEqual(
            names,
            {200011: "Sotiyo", 200012: "Sotiyo", 200013: "Sotiyo", 200014: ""},
        )

    def test_get_owner_bpos_should_return_forbidden_for_other_user(self):
        # Test Data
        self.client.force_login(self.user)
        other_user = UserMainFactory()
        owner_other = OwnerFactory(user=other_user, is_public=False)

        # Test Action
        response = self.client.get(
            f"/bpforge/api/settings/owners/{owner_other.id}/bpos/"
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)

    def test_get_user_owners_should_include_status_and_sections(self):
        # Test Data
        self.client.force_login(self.user)
        owner = OwnerFactory(user=self.user, is_public=False)

        OwnerUpdateStatusFactory(
            owner=owner,
            section=OwnerUpdateSection.BLUEPRINTS,
            is_success=True,
        )
        OwnerUpdateStatusFactory(
            owner=owner,
            section=OwnerUpdateSection.LOCATIONS,
            is_success=False,
            error_message="Location lookup error",
        )

        # Test Action
        response = self.client.get("/bpforge/api/settings/owners/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        owner_data = next((item for item in data if item["id"] == owner.id), None)
        self.assertIsNotNone(owner_data)
        self.assertEqual(owner_data["status"], "error")
        self.assertTrue(owner_data["has_error"])
        self.assertIn("Location lookup error", owner_data["error_message"])
        self.assertEqual(len(owner_data["sections"]), 2)
        section_names = [s["section"] for s in owner_data["sections"]]
        self.assertIn("blueprints", section_names)
        self.assertIn("locations", section_names)

    def test_get_user_character_statuses_should_return_character_statuses(self):
        # Test Data
        self.client.force_login(self.user)
        OwnerFactory(user=self.user, is_public=False)

        # Test Action
        response = self.client.get("/bpforge/api/user/characters/status/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 1)
        main_char = self.user.profile.main_character
        char_entry = next(
            (item for item in data if item["character_id"] == main_char.character_id),
            None,
        )
        self.assertEqual(char_entry["character_name"], main_char.character_name)

    @patch("bpforge.api.general.update_owner.delay")
    def test_trigger_owner_update_settings_should_queue_task(self, mock_delay):
        # Test Data
        self.client.force_login(self.user)
        owner = OwnerFactory(user=self.user)

        # Test Action
        response = self.client.post(
            f"/bpforge/api/settings/owners/{owner.id}/update/",
            data=json.dumps({"force_refresh": True}),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertTrue(data["success"])
        mock_delay.assert_called_once_with(owner_pk=owner.pk, force_refresh=True)

    def test_trigger_owner_update_settings_for_other_user_should_return_forbidden(
        self,
    ):
        # Test Data
        self.client.force_login(self.user)
        other_user = UserMainFactory()
        owner_other = OwnerFactory(user=other_user)

        # Test Action
        response = self.client.post(
            f"/bpforge/api/settings/owners/{owner_other.id}/update/",
            data=json.dumps({}),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)

    @patch("bpforge.api.general.update_owner.delay")
    def test_trigger_update_all_user_owners_should_queue_tasks(self, mock_delay):
        # Test Data
        self.client.force_login(self.user)
        OwnerFactory(user=self.user)
        alt_ownership = add_character_to_user(
            user=self.user, character=EveCharacterFactory(), is_main=False
        )
        OwnerFactory(user=self.user, character=alt_ownership)
        other_user = UserMainFactory()
        OwnerFactory(user=other_user)

        # Test Action
        response = self.client.post(
            "/bpforge/api/settings/owners/update-all/",
            data=json.dumps({"force_refresh": False}),
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertGreaterEqual(mock_delay.call_count, 2)

    def test_delete_owner_settings_should_delete_owner(self):
        # Test Data
        self.client.force_login(self.user)
        owner = OwnerFactory(user=self.user)
        owner_id = owner.id

        # Test Action
        response = self.client.delete(f"/bpforge/api/settings/owners/{owner_id}/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertFalse(Owner.objects.filter(id=owner_id).exists())

    def test_delete_owner_settings_for_other_user_should_return_forbidden(self):
        # Test Data
        self.client.force_login(self.user)
        other_user = UserMainFactory()
        owner_other = OwnerFactory(user=other_user)

        # Test Action
        response = self.client.delete(f"/bpforge/api/settings/owners/{owner_other.id}/")

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
