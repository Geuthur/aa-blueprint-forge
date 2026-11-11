"""Tests for the tasks and their retry on ESI errors."""

# Standard Library
from http import HTTPStatus
from unittest.mock import patch

# Third Party
import pook
from aiopenapi3 import RequestError
from celery.exceptions import Retry
from evesde_factory.utils import add_new_token

# Django
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone

# Alliance Auth
from esi.exceptions import (
    ESIBucketLimitException,
    ESIErrorLimitException,
    HTTPServerError,
)

# AA Blueprint Forge
from bpforge import tasks
from bpforge.errors import DownTimeError
from bpforge.models.blueprint import Owner, OwnerUpdateStatus
from bpforge.models.helpers.update_manager import OwnerUpdateSection
from bpforge.providers import DOWNTIME_TIMER
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.bpforge import OwnerFactory
from bpforge.tests.testdata.esi import (
    assets_url,
    blueprints_url,
    clear_esi_limits,
    structure_url,
)

TASK_PATH = "bpforge.tasks"
STRUCTURE_ID = 1049854533347


class EsiTaskTestCase(AuthTestCase):
    """Character owner with a valid token and a clean ESI limit cache."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.owner = OwnerFactory(user=cls.user)
        cls.token = add_new_token(
            cls.user, cls.owner.character.character, Owner.get_character_scopes()
        )

    def setUp(self):
        super().setUp()
        clear_esi_limits(self.owner)
        self.addCleanup(clear_esi_limits, self.owner)

    def _assert_retried(self, mock_retry, exc_type, countdown_min: float):
        mock_retry.assert_called_once()
        kwargs = mock_retry.call_args.kwargs
        self.assertIsInstance(kwargs["exc"], exc_type)
        self.assertGreaterEqual(kwargs["countdown"], countdown_min)

    def _assert_blueprints_failed(self, error_prefix: str):
        status = OwnerUpdateStatus.objects.get(
            owner=self.owner, section=OwnerUpdateSection.BLUEPRINTS
        )
        self.assertFalse(status.is_success)
        self.assertTrue(status.error_message.startswith(error_prefix))


@override_settings(CELERY_ALWAYS_EAGER=True, CELERY_EAGER_PROPAGATES_EXCEPTIONS=True)
class TestUpdateOwner(EsiTaskTestCase):
    @patch(TASK_PATH + ".Owner.execute_section", autospec=True)
    def test_should_execute_stale_sections(self, mock_execute_section):
        # Test Action
        result = tasks.update_owner(self.owner.pk)

        # Expected Result
        self.assertTrue(result)
        self.assertEqual(mock_execute_section.call_count, 2)

    def test_should_return_false_for_unknown_owner(self):
        # Test Action & Expected Result
        self.assertFalse(tasks.update_owner(999999))

    @override_settings(DISABLE_DAILY_DOWNTIME_CHECK=False)
    @patch(TASK_PATH + ".Owner.execute_section", autospec=True)
    def test_should_retry_during_daily_downtime(self, mock_execute_section):
        # Test Data
        with patch("bpforge.providers.timezone.now") as mock_now:
            mock_now.return_value = timezone.datetime.strptime("11:05", "%H:%M")

            # Test Action & Expected Result: the retry raises in eager mode
            with self.assertRaises(DownTimeError):
                tasks.update_owner(self.owner.pk)
        mock_execute_section.assert_not_called()


@override_settings(CELERY_ALWAYS_EAGER=True, CELERY_EAGER_PROPAGATES_EXCEPTIONS=True)
@patch.object(tasks.update_owner, "retry", side_effect=Retry)
class TestUpdateOwnerEsiErrors(EsiTaskTestCase):
    """ESI errors of a section reach `retry_task_on_esi_error` through the UpdateManager."""

    def test_should_retry_on_esi_server_errors(self, mock_retry):
        for status_code in [
            HTTPStatus.BAD_GATEWAY,
            HTTPStatus.SERVICE_UNAVAILABLE,
            HTTPStatus.GATEWAY_TIMEOUT,
        ]:
            with self.subTest(status_code=status_code), pook.use():
                # Test Data
                mock_retry.reset_mock()
                pook.get(
                    blueprints_url(self.owner),
                    reply=status_code,
                    response_json={"error": status_code.phrase},
                )

                # Test Action
                with self.assertRaises(Retry):
                    tasks.update_owner(self.owner.pk)

                # Expected Result
                self._assert_retried(mock_retry, HTTPServerError, DOWNTIME_TIMER)
                self._assert_blueprints_failed("HTTPServerError")

    @pook.on
    def test_should_retry_on_the_esi_error_limit(self, mock_retry):
        # Test Data
        pook.get(
            blueprints_url(self.owner),
            reply=420,
            response_json={"error": "Error limited"},
            response_headers={"X-RateLimit-Reset": "30"},
        )

        # Test Action
        with self.assertRaises(Retry):
            tasks.update_owner(self.owner.pk)

        # Expected Result
        self._assert_retried(mock_retry, ESIErrorLimitException, 30)
        self._assert_blueprints_failed("ESIErrorLimitException")

    @pook.on
    def test_should_retry_on_the_esi_bucket_limit(self, mock_retry):
        # Test Data: the industry bucket of the character is used up
        cache.set(
            f"esi:bucket:char-industry:{self.owner.character.character.character_id}",
            0,
            timeout=900,
        )

        # Test Action
        with self.assertRaises(Retry):
            tasks.update_owner(self.owner.pk)

        # Expected Result
        self._assert_retried(mock_retry, ESIBucketLimitException, 1)
        self._assert_blueprints_failed("ESIBucketLimitException")

    @pook.on
    @patch("esi.app_settings.ESI_SERVER_ERROR_MAX_RETRIES", 1)
    def test_should_retry_on_request_errors(self, mock_retry):
        # Test Data
        pook.get(blueprints_url(self.owner)).error(ConnectionError("Connection reset"))

        # Test Action
        with self.assertRaises(Retry):
            tasks.update_owner(self.owner.pk)

        # Expected Result
        self._assert_retried(mock_retry, RequestError, DOWNTIME_TIMER)
        self._assert_blueprints_failed("RequestError")

    @patch(TASK_PATH + ".Owner.update_blueprints", autospec=True)
    def test_should_retry_on_downtime_errors_of_a_section(
        self, mock_update_blueprints, mock_retry
    ):
        # Test Data
        mock_update_blueprints.side_effect = DownTimeError("ESI is in daily downtime")

        # Test Action
        with self.assertRaises(Retry):
            tasks.update_owner(self.owner.pk)

        # Expected Result
        self._assert_retried(mock_retry, DownTimeError, DOWNTIME_TIMER)
        self._assert_blueprints_failed("DownTimeError")

    def test_should_record_other_esi_errors_without_retry(self, mock_retry):
        for status_code in [HTTPStatus.INTERNAL_SERVER_ERROR, HTTPStatus.NOT_FOUND]:
            with self.subTest(status_code=status_code), pook.use():
                # Test Data
                for url in (blueprints_url(self.owner), assets_url(self.owner)):
                    pook.get(
                        url,
                        reply=status_code,
                        response_json={"error": status_code.phrase},
                    )

                # Test Action
                result = tasks.update_owner(self.owner.pk, force_refresh=True)

                # Expected Result
                self.assertTrue(result)
                mock_retry.assert_not_called()
                for section in OwnerUpdateSection:
                    status = OwnerUpdateStatus.objects.get(
                        owner=self.owner, section=section
                    )
                    self.assertFalse(status.is_success)
                    self.assertIn(str(status_code.value), status.error_message)


@override_settings(CELERY_ALWAYS_EAGER=True, CELERY_EAGER_PROPAGATES_EXCEPTIONS=True)
class TestUpdateSectionTasks(EsiTaskTestCase):
    def test_should_retry_section_tasks_on_retryable_esi_errors(self):
        cases = [
            (tasks.update_blueprints, blueprints_url(self.owner)),
            (tasks.update_locations, assets_url(self.owner)),
        ]
        for task, url in cases:
            with (
                self.subTest(task=task.name),
                pook.use(),
                patch.object(task, "retry", side_effect=Retry) as mock_retry,
            ):
                # Test Data
                pook.get(
                    url,
                    reply=HTTPStatus.BAD_GATEWAY,
                    response_json={"error": "Bad Gateway"},
                )

                # Test Action
                with self.assertRaises(Retry):
                    task(owner_pk=self.owner.pk, force_refresh=True)

                # Expected Result
                self._assert_retried(mock_retry, HTTPServerError, DOWNTIME_TIMER)

    @pook.on
    @patch.object(tasks.update_structure_esi, "retry", side_effect=Retry)
    def test_update_structure_esi_should_retry_on_esi_server_errors(self, mock_retry):
        # Test Data
        pook.get(
            structure_url(STRUCTURE_ID),
            reply=HTTPStatus.SERVICE_UNAVAILABLE,
            response_json={"error": "Service Unavailable"},
        )

        # Test Action
        with self.assertRaises(Retry):
            tasks.update_structure_esi(
                structure_id=STRUCTURE_ID, token_pk=self.token.pk
            )

        # Expected Result
        self._assert_retried(mock_retry, HTTPServerError, DOWNTIME_TIMER)

    @pook.on
    @patch.object(tasks.update_structure_esi, "retry", side_effect=Retry)
    def test_update_structure_esi_should_not_retry_on_other_errors(self, mock_retry):
        # Test Data
        pook.get(
            structure_url(STRUCTURE_ID),
            reply=HTTPStatus.INTERNAL_SERVER_ERROR,
            response_json={"error": "Internal Server Error"},
        )

        # Test Action & Expected Result
        with self.assertRaises(HTTPServerError):
            tasks.update_structure_esi(
                structure_id=STRUCTURE_ID, token_pk=self.token.pk
            )
        mock_retry.assert_not_called()
