"""Tests for the ESI error handling of the UpdateManager."""

# Standard Library
from http import HTTPStatus
from unittest.mock import MagicMock

# Third Party
from aiopenapi3 import RequestError

# Alliance Auth
from esi.errors import TokenError
from esi.exceptions import (
    ESIBucketLimitException,
    ESIErrorLimitException,
    HTTPClientError,
    HTTPNotModified,
    HTTPServerError,
)
from esi.rate_limiting import ESIRateLimitBucket

# AA Blueprint Forge
from bpforge.errors import DownTimeError
from bpforge.models.blueprint import OwnerUpdateStatus
from bpforge.models.helpers.update_manager import UpdateSection
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.bpforge import OwnerFactory


def retryable_errors() -> list[Exception]:
    """Errors on which `retry_task_on_esi_error` retries the task."""
    return [
        ESIErrorLimitException(reset=60),
        ESIBucketLimitException(ESIRateLimitBucket("char-industry:1", 600, 900), 60),
        HTTPServerError(HTTPStatus.BAD_GATEWAY, {}, b"Bad Gateway"),
        HTTPServerError(HTTPStatus.SERVICE_UNAVAILABLE, {}, b"Service Unavailable"),
        HTTPServerError(HTTPStatus.GATEWAY_TIMEOUT, {}, b"Gateway Timeout"),
        RequestError(
            operation=None, request=None, data="Request failed", parameters={}
        ),
        DownTimeError("ESI is in daily downtime"),
    ]


class TestUpdateManagerEsiErrors(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.owner = OwnerFactory(user=self.user)
        self.manager = self.owner.update_manager

    def test_perform_update_status_should_raise_retryable_esi_errors(self):
        for exc in retryable_errors():
            with self.subTest(exc=type(exc).__name__):
                # Test Data
                mock_method = MagicMock(side_effect=exc)

                # Test Action & Expected Result
                with self.assertRaises(type(exc)) as ctx:
                    self.manager.perform_update_status(
                        section=UpdateSection.BLUEPRINTS,
                        method=mock_method,
                    )
                self.assertIs(ctx.exception, exc)

    def test_update_section_if_changed_should_raise_retryable_esi_errors(self):
        for exc in retryable_errors():
            with self.subTest(exc=type(exc).__name__):
                # Test Data
                fetch_func = MagicMock(side_effect=exc)

                # Test Action & Expected Result
                with self.assertRaises(type(exc)):
                    self.manager.update_section_if_changed(
                        section=UpdateSection.BLUEPRINTS,
                        fetch_func=fetch_func,
                    )

    def test_perform_update_status_should_catch_other_esi_errors(self):
        cases = [
            (HTTPServerError(HTTPStatus.INTERNAL_SERVER_ERROR, {}, b"Error"), "500"),
            (HTTPClientError(HTTPStatus.NOT_FOUND, {}, b"Not Found"), "404"),
        ]
        for exc, expected in cases:
            with self.subTest(exc=expected):
                # Test Data
                mock_method = MagicMock(side_effect=exc)

                # Test Action
                result = self.manager.perform_update_status(
                    section=UpdateSection.BLUEPRINTS,
                    method=mock_method,
                )

                # Expected Result
                self.assertFalse(result.is_updated)
                self.assertFalse(result.has_token_error)
                self.assertIn(expected, result.error_message)

    def test_perform_update_status_should_catch_not_modified_and_token_errors(self):
        # Test Data
        not_modified = MagicMock(side_effect=HTTPNotModified(304, {}))
        token_error = MagicMock(side_effect=TokenError("No token"))

        # Test Action
        result_not_modified = self.manager.perform_update_status(
            section=UpdateSection.BLUEPRINTS, method=not_modified
        )
        result_token_error = self.manager.perform_update_status(
            section=UpdateSection.BLUEPRINTS, method=token_error
        )

        # Expected Result
        self.assertEqual(result_not_modified.error_message, "")
        self.assertTrue(result_token_error.has_token_error)

    def test_execute_section_should_record_and_raise_retryable_esi_errors(self):
        for exc in retryable_errors():
            with self.subTest(exc=type(exc).__name__):
                # Test Data
                self.owner.update_blueprints = MagicMock(side_effect=exc)

                # Test Action
                with self.assertRaises(type(exc)):
                    self.manager.execute_section(UpdateSection.BLUEPRINTS)

                # Expected Result: a failed run, not success and not in progress
                status = OwnerUpdateStatus.objects.get(
                    owner=self.owner, section=UpdateSection.BLUEPRINTS
                )
                self.assertFalse(status.is_success)
                self.assertFalse(status.has_token_error)
                self.assertTrue(status.error_message.startswith(type(exc).__name__))
                self.assertIsNotNone(status.last_run_finished_at)
                self.assertTrue(status.need_update())
