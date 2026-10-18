# Standard Library
import json
from http import HTTPStatus

# Django
from django.urls import reverse

# AA Blueprint Forge
from bpforge.models.helpers.update_manager import UpdateSection
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
from bpforge.tests.testdata.bpforge import (
    BlueprintFactory,
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
        self.assertEqual(overview_link["link"], "/overview/")

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
            section=UpdateSection.BLUEPRINTS,
            is_success=True,
        )
        OwnerUpdateStatusFactory(
            owner=owner,
            section=UpdateSection.LOCATIONS,
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
        self.assertIsNotNone(char_entry)
        self.assertEqual(char_entry["character_name"], main_char.character_name)
