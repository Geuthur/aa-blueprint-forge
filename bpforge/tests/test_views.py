# Standard Library
from http import HTTPStatus
from unittest.mock import Mock, patch

# Django
from django.urls import reverse

# Alliance Auth
from allianceauth.eveonline.models import EveCharacter, EveCorporationInfo

# AA Blueprint Forge
from bpforge.models.blueprint import Owner
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
from bpforge.tests.testdata.factory import (
    EveCharacterFactory,
    EveCorporationInfoFactory,
)
from bpforge.views import add_character, add_corporation, react_base


class TestViews(AuthTestCase):
    def test_react_base_should_render_template(self):
        # Test Data
        self.client.force_login(self.user)

        # Test Action
        response = self.client.get(reverse("bpforge:react_base"))

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertTemplateUsed(response, "bpforge/react_base.html")

    @patch("bpforge.views.update_owner.delay")
    def test_add_character_should_create_owner_and_redirect_to_settings(
        self, mock_delay
    ):
        # Test Data
        main_char = self.user.profile.main_character
        request = self.factory.get(reverse("bpforge:add_character"))
        request.user = self.user
        self._middleware_process_request(request)
        token = Mock()
        token.character_id = main_char.character_id

        # Unwrap @login_required and @token_required decorators
        view_func = add_character.__wrapped__.__wrapped__

        # Test Action
        response = view_func(request, token)

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FOUND)
        self.assertEqual(response.url, "/bpforge/settings/")
        mock_delay.assert_called_once()
        self.assertTrue(
            Owner.objects.filter(
                user=self.user,
                character__character=main_char,
                corporation__isnull=True,
            ).exists()
        )

    def test_add_character_should_redirect_to_settings_when_character_not_owned(self):
        # Test Data
        other_user = UserMainFactory()
        other_char = other_user.profile.main_character
        request = self.factory.get(reverse("bpforge:add_character"))
        request.user = self.user
        self._middleware_process_request(request)
        token = Mock()
        token.character_id = other_char.character_id

        view_func = add_character.__wrapped__.__wrapped__

        # Test Action
        response = view_func(request, token)

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FOUND)
        self.assertEqual(response.url, "/bpforge/settings/")

    @patch("bpforge.views.update_owner.delay")
    def test_add_corporation_should_create_owner_and_redirect_to_settings(
        self, mock_delay
    ):
        # Test Data
        main_char = self.user.profile.main_character
        request = self.factory.get(reverse("bpforge:add_corporation"))
        request.user = self.user
        self._middleware_process_request(request)
        token = Mock()
        token.character_id = main_char.character_id

        view_func = add_corporation.__wrapped__.__wrapped__

        # Test Action
        response = view_func(request, token)

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FOUND)
        self.assertEqual(response.url, "/bpforge/settings/")
        mock_delay.assert_called_once()
        self.assertTrue(
            Owner.objects.filter(
                user=self.user,
                corporation__corporation_id=main_char.corporation_id,
            ).exists()
        )

    def test_add_corporation_should_redirect_to_settings_when_character_not_owned(self):
        # Test Data
        other_user = UserMainFactory()
        other_char = other_user.profile.main_character
        request = self.factory.get(reverse("bpforge:add_corporation"))
        request.user = self.user
        self._middleware_process_request(request)
        token = Mock()
        token.character_id = other_char.character_id

        view_func = add_corporation.__wrapped__.__wrapped__

        # Test Action
        response = view_func(request, token)

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FOUND)
        self.assertEqual(response.url, "/bpforge/settings/")
