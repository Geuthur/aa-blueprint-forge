"""Tests for who may see, order from and manage an owner through the API."""

# Standard Library
import json
from http import HTTPStatus
from unittest.mock import patch

# Third Party
from evesde_factory.allianceauth import UserFactory
from evesde_factory.eve_sde import ItemTypeFactory

# AA Blueprint Forge
from bpforge.models.blueprint import Owner
from bpforge.models.request import Order
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
from bpforge.tests.testdata.bpforge import BlueprintFactory, OwnerFactory

API = "/bpforge/api/"
SEARCH_TERM = "Zzq Access"

# (method, path below `settings/owners/<id>/`, payload)
MANAGE_ENDPOINTS = [
    ("patch", "", {"is_public": True}),
    ("get", "bpos/", None),
    ("post", "bpos/", {"offered_item_ids": []}),
    ("post", "update/", {"force_refresh": False}),
    ("delete", "", None),
]


class OwnerAccessTestCase(AuthTestCase):
    """`self.user` is a stranger to every owner created here."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.owner_user = UserMainFactory()
        cls.admin = UserMainFactory(
            permissions__=["bpforge.basic_access", "bpforge.full_access"]
        )
        cls.no_main = UserFactory(permissions__=["bpforge.basic_access"])
        cls.eve_type = ItemTypeFactory(name=f"{SEARCH_TERM} Blueprint")

    def _call(self, user, method: str, path: str, payload=None):
        self.client.force_login(user)
        kwargs = {}
        if payload is not None:
            kwargs = {"data": json.dumps(payload), "content_type": "application/json"}
        return getattr(self.client, method)(f"{API}{path}", **kwargs)

    def _owner_with_blueprints(self, **kwargs):
        """An owner with an offered BPO, a BPO that is not offered and a BPC."""
        owner = OwnerFactory(user=self.owner_user, **kwargs)
        self.bpo = BlueprintFactory(owner=owner, eve_type=self.eve_type, runs=None)
        self.bpo_hidden = BlueprintFactory(
            owner=owner, eve_type=self.eve_type, runs=None, is_offered=False
        )
        self.bpc = BlueprintFactory(owner=owner, eve_type=self.eve_type, runs=10)
        return owner


@patch("bpforge.api.general.update_owner.delay")
class TestManageOwner(OwnerAccessTestCase):
    def _manage(self, user, owner_id, endpoint):
        method, path, payload = endpoint
        return self._call(user, method, f"settings/owners/{owner_id}/{path}", payload)

    def test_should_allow_the_owner(self, _):
        for endpoint in MANAGE_ENDPOINTS:
            with self.subTest(endpoint=endpoint):
                owner = OwnerFactory(user=self.owner_user, is_public=False)
                response = self._manage(self.owner_user, owner.id, endpoint)
                self.assertEqual(response.status_code, HTTPStatus.OK)
                owner.delete()

    def test_should_allow_admin_access_on_foreign_owner(self, _):
        for endpoint in MANAGE_ENDPOINTS:
            with self.subTest(endpoint=endpoint):
                owner = OwnerFactory(user=self.owner_user, is_public=False)
                response = self._manage(self.admin, owner.id, endpoint)
                self.assertEqual(response.status_code, HTTPStatus.OK)
                owner.delete()

    def test_should_return_forbidden_for_stranger_even_if_public(self, mock_delay):
        for is_public in (False, True):
            owner = OwnerFactory(user=self.owner_user, is_public=is_public)
            for endpoint in MANAGE_ENDPOINTS:
                with self.subTest(endpoint=endpoint, is_public=is_public):
                    response = self._manage(self.user, owner.id, endpoint)
                    self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
                    self.assertEqual(response.json(), {"error": "Permission Denied."})
            owner.refresh_from_db()
            self.assertEqual(owner.is_public, is_public)
            owner.delete()
        mock_delay.assert_not_called()

    def test_should_return_not_found_for_missing_owner(self, _):
        for user in (self.user, self.admin):
            for endpoint in MANAGE_ENDPOINTS:
                with self.subTest(endpoint=endpoint, user=user):
                    response = self._manage(user, 999999, endpoint)
                    self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
                    self.assertEqual(response.json(), {"error": "Owner not found."})

    def test_should_redirect_owner_without_main(self, mock_delay):
        # Alliance Auth requires a main character for every URL of an app
        owner = OwnerFactory(user=self.no_main, is_public=False)
        for endpoint in MANAGE_ENDPOINTS:
            with self.subTest(endpoint=endpoint):
                response = self._manage(self.no_main, owner.id, endpoint)
                self.assertEqual(response.status_code, HTTPStatus.FOUND)
        self.assertTrue(Owner.objects.filter(id=owner.id, is_public=False).exists())
        mock_delay.assert_not_called()


class TestCatalogAccess(OwnerAccessTestCase):
    def _catalog(self, user, owner_id):
        return self._call(user, "get", f"blueprints/{owner_id}/")

    def test_private_catalog_should_be_forbidden_for_stranger(self):
        owner = self._owner_with_blueprints(is_public=False)
        response = self._catalog(self.user, owner.id)
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertEqual(
            response.json(), {"error": "This blueprint catalog is private."}
        )

    def test_private_catalog_should_be_visible_to_owner_and_admin(self):
        owner = self._owner_with_blueprints(is_public=False)
        for user in (self.owner_user, self.admin):
            with self.subTest(user=user):
                response = self._catalog(user, owner.id)
                self.assertEqual(response.status_code, HTTPStatus.OK)
                self.assertEqual(len(response.json()), 3)

    def test_public_catalog_should_be_visible_to_stranger(self):
        owner = self._owner_with_blueprints(is_public=True)
        response = self._catalog(self.user, owner.id)
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(len(response.json()), 3)

    def test_missing_catalog_should_return_not_found(self):
        response = self._catalog(self.user, 999999)
        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
        self.assertEqual(response.json(), {"error": "Owner not found."})

    def test_public_catalog_should_redirect_without_main(self):
        owner = self._owner_with_blueprints(is_public=True)
        response = self._catalog(self.no_main, owner.id)
        self.assertEqual(response.status_code, HTTPStatus.FOUND)


class TestCatalogFilter(OwnerAccessTestCase):
    """The catalog of an owner and the search offer the same blueprints."""

    def _expected(self, public_type: str, selective: bool) -> set[int]:
        expected = set()
        if public_type != "bpc":
            expected.add(self.bpo.item_id)
            if not selective:
                expected.add(self.bpo_hidden.item_id)
        if public_type != "bpo":
            expected.add(self.bpc.item_id)
        return expected

    def _item_ids(self, user, path: str) -> set[int]:
        response = self._call(user, "get", path)
        self.assertEqual(response.status_code, HTTPStatus.OK)
        return {item["item_id"] for item in response.json()}

    def test_catalog_should_follow_public_type_and_selective_bpo_for_everyone(self):
        owner = self._owner_with_blueprints(is_public=True)
        for public_type in ("all", "bpo", "bpc"):
            for selective in (False, True):
                owner.public_type = public_type
                owner.selective_bpo_enabled = selective
                owner.save()
                for user in (self.user, self.owner_user, self.admin):
                    with self.subTest(
                        public_type=public_type, selective=selective, user=user
                    ):
                        self.assertEqual(
                            self._item_ids(user, f"blueprints/{owner.id}/"),
                            self._expected(public_type, selective),
                        )

    def test_search_should_follow_public_type_and_selective_bpo_for_everyone(self):
        owner = self._owner_with_blueprints(is_public=True)
        for public_type in ("all", "bpo", "bpc"):
            for selective in (False, True):
                owner.public_type = public_type
                owner.selective_bpo_enabled = selective
                owner.save()
                for user in (self.user, self.owner_user, self.admin):
                    with self.subTest(
                        public_type=public_type, selective=selective, user=user
                    ):
                        self.assertEqual(
                            self._item_ids(user, f"blueprints/search/?q={SEARCH_TERM}"),
                            self._expected(public_type, selective),
                        )

    def test_search_should_not_show_private_owner_to_anyone(self):
        self._owner_with_blueprints(is_public=False)
        for user in (self.user, self.owner_user, self.admin):
            with self.subTest(user=user):
                self.assertEqual(
                    self._item_ids(user, f"blueprints/search/?q={SEARCH_TERM}"), set()
                )

    def test_public_shop_list_should_not_show_private_owner_to_anyone(self):
        owner = self._owner_with_blueprints(is_public=False)
        for user in (self.user, self.owner_user, self.admin):
            with self.subTest(user=user):
                response = self._call(user, "get", "blueprints/")
                self.assertEqual(response.status_code, HTTPStatus.OK)
                self.assertNotIn(owner.id, [shop["id"] for shop in response.json()])

    def test_unknown_public_type_should_count_as_all(self):
        owner = self._owner_with_blueprints(is_public=True, public_type="unknown")
        expected = self._expected("all", False)
        self.assertEqual(self._item_ids(self.user, f"blueprints/{owner.id}/"), expected)
        self.assertEqual(
            self._item_ids(self.user, f"blueprints/search/?q={SEARCH_TERM}"), expected
        )


@patch("bpforge.api.orders.notify_order_created")
class TestOrderAccess(OwnerAccessTestCase):
    def _order(self, user, owner_id, *blueprints):
        payload = {
            "owner_id": owner_id,
            "note": "",
            "items": [
                {"blueprint_id": bp.item_id, "quantity": 1, "runs": 1}
                for bp in blueprints
            ],
        }
        return self._call(user, "post", "orders/", payload)

    def _assert_rejected(self, response, error: str):
        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertEqual(response.json(), {"error": error})
        self.assertFalse(Order.objects.exists())

    def test_private_shop_should_be_forbidden_for_stranger(self, _):
        owner = self._owner_with_blueprints(is_public=False)
        response = self._order(self.user, owner.id, self.bpo)
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertEqual(
            response.json(), {"error": "Cannot order from a private shop."}
        )
        self.assertFalse(Order.objects.exists())

    def test_private_shop_should_accept_owner_and_admin(self, _):
        owner = self._owner_with_blueprints(is_public=False)
        for user in (self.owner_user, self.admin):
            with self.subTest(user=user):
                response = self._order(user, owner.id, self.bpo)
                self.assertEqual(response.status_code, HTTPStatus.CREATED)

    def test_missing_shop_should_return_not_found(self, _):
        response = self._order(self.user, 999999, BlueprintFactory())
        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
        self.assertEqual(response.json(), {"error": "Owner not found."})

    def test_public_shop_should_redirect_without_main(self, _):
        owner = self._owner_with_blueprints(is_public=True)
        response = self._order(self.no_main, owner.id, self.bpo)
        self.assertEqual(response.status_code, HTTPStatus.FOUND)
        self.assertFalse(Order.objects.exists())

    def test_bpo_shop_should_reject_copy_for_stranger(self, _):
        owner = self._owner_with_blueprints(public_type="bpo")
        self._assert_rejected(
            self._order(self.user, owner.id, self.bpo, self.bpc),
            "This shop only offers blueprint originals (BPO).",
        )

    def test_bpc_shop_should_reject_original_for_stranger(self, _):
        owner = self._owner_with_blueprints(public_type="bpc")
        self._assert_rejected(
            self._order(self.user, owner.id, self.bpo, self.bpc),
            "This shop only offers blueprint copies (BPC).",
        )

    def test_selective_shop_should_reject_bpo_that_is_not_offered(self, _):
        owner = self._owner_with_blueprints(selective_bpo_enabled=True)
        self._assert_rejected(
            self._order(self.user, owner.id, self.bpo, self.bpo_hidden),
            "One or more selected BPOs are not offered by this shop.",
        )

    def test_stranger_should_order_everything_in_the_catalog(self, _):
        cases = [
            ("all", False, ["bpo", "bpo_hidden", "bpc"]),
            ("all", True, ["bpo", "bpc"]),
            ("bpo", False, ["bpo", "bpo_hidden"]),
            ("bpo", True, ["bpo"]),
            ("bpc", False, ["bpc"]),
            ("bpc", True, ["bpc"]),
        ]
        for public_type, selective, names in cases:
            with self.subTest(public_type=public_type, selective=selective):
                owner = self._owner_with_blueprints(
                    public_type=public_type, selective_bpo_enabled=selective
                )
                blueprints = [getattr(self, name) for name in names]
                response = self._order(self.user, owner.id, *blueprints)
                self.assertEqual(response.status_code, HTTPStatus.CREATED)
                owner.delete()

    def test_owner_and_admin_should_order_outside_the_catalog(self, _):
        for public_type, selective in (("bpo", True), ("bpc", True)):
            for user in (self.owner_user, self.admin):
                with self.subTest(public_type=public_type, user=user):
                    owner = self._owner_with_blueprints(
                        public_type=public_type, selective_bpo_enabled=selective
                    )
                    response = self._order(
                        user, owner.id, self.bpo, self.bpo_hidden, self.bpc
                    )
                    self.assertEqual(response.status_code, HTTPStatus.CREATED)
                    owner.delete()

    def test_should_reject_blueprint_of_another_shop(self, _):
        owner = self._owner_with_blueprints()
        self._assert_rejected(
            self._order(self.user, owner.id, BlueprintFactory()),
            "One or more blueprints are invalid or do not belong to this shop.",
        )
