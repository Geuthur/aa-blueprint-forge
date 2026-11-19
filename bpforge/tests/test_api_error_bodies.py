"""Tests for the error bodies of the API: every error is `{"error": "<text>"}`."""

# Standard Library
from http import HTTPStatus

# AA Blueprint Forge
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
from bpforge.tests.testdata.bpforge import OrderFactory

API = "/bpforge/api/"
MISSING_ID = 999999


class TestApiNotFound(AuthTestCase):
    """Missing objects answer 404 with an `error` body, not with `detail`."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.manager = UserMainFactory(
            permissions__=["bpforge.basic_access", "bpforge.full_access"]
        )
        cls.manager.is_superuser = True
        cls.manager.save()

    def test_missing_objects_should_return_not_found_with_error_body(self):
        # Test Data
        order_payload = {"owner_id": MISSING_ID, "items": [{"blueprint_id": 1}]}
        cases = [
            ("get", f"blueprints/{MISSING_ID}/", None, "Owner not found."),
            ("post", "orders/", order_payload, "Owner not found."),
            ("get", f"orders/{MISSING_ID}/", None, "Order not found."),
            (
                "post",
                f"orders/{MISSING_ID}/status/",
                {"status": "Accepted"},
                "Order not found.",
            ),
            ("delete", f"orders/{MISSING_ID}/", None, "Order not found."),
            (
                "patch",
                f"settings/owners/{MISSING_ID}/",
                {"is_public": True},
                "Owner not found.",
            ),
            ("get", f"settings/owners/{MISSING_ID}/bpos/", None, "Owner not found."),
            (
                "post",
                f"settings/owners/{MISSING_ID}/bpos/",
                {"offered_item_ids": []},
                "Owner not found.",
            ),
            ("post", f"settings/owners/{MISSING_ID}/update/", None, "Owner not found."),
            ("delete", f"settings/owners/{MISSING_ID}/", None, "Owner not found."),
            (
                "patch",
                f"administration/owners/{MISSING_ID}/",
                {"is_public": True},
                "Owner not found.",
            ),
            (
                "get",
                f"administration/owners/{MISSING_ID}/blueprints/",
                None,
                "Owner not found.",
            ),
            (
                "post",
                f"administration/owners/{MISSING_ID}/update/",
                None,
                "Owner not found.",
            ),
            (
                "delete",
                f"administration/owners/{MISSING_ID}/",
                None,
                "Owner not found.",
            ),
        ]
        self.client.force_login(self.manager)

        for method, path, payload, message in cases:
            with self.subTest(method=method.upper(), path=path):
                # Test Action
                response = getattr(self.client, method)(
                    f"{API}{path}",
                    data=payload,
                    content_type="application/json",
                )

                # Expected Result
                self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
                self.assertEqual(response.json(), {"error": message})


class TestApiErrorBodies(AuthTestCase):
    """Errors with a value in the text are translated before the value is added."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.manager = UserMainFactory(
            permissions__=["bpforge.basic_access", "bpforge.full_access"]
        )

    def test_update_order_status_should_return_error_for_invalid_status(self):
        # Test Data
        order = OrderFactory()
        self.client.force_login(self.manager)

        # Test Action
        response = self.client.post(
            f"{API}orders/{order.pk}/status/",
            data={"status": "Nonsense"},
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        error = response.json()["error"]
        self.assertTrue(error.startswith("Invalid status. Must be one of: ["))
        self.assertNotIn("{valid_statuses}", error)

    def test_trigger_owner_update_should_return_error_without_superuser_for_force(
        self,
    ):
        # Test Data
        order = OrderFactory()
        self.client.force_login(self.manager)

        # Test Action
        response = self.client.post(
            f"{API}administration/owners/{order.owner_id}/update/",
            data={"force_refresh": True},
            content_type="application/json",
        )

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertEqual(response.json(), {"error": "Superuser permission required."})
