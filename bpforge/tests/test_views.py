# Standard Library
from http import HTTPStatus
from unittest.mock import Mock, patch

# Third Party
from evesde_factory.allianceauth import (
    EveCharacterFactory,
    EveCorporationInfoFactory,
    UserFactory,
)

# Django
from django.urls import reverse

# Alliance Auth
from allianceauth.eveonline.models import EveCharacter, EveCorporationInfo

# AA Blueprint Forge
from bpforge.models.blueprint import Owner
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
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
        self.assertNotIn("character_id", response.context)

    def test_react_base_should_render_spa_sub_routes(self):
        # Test Data
        self.client.force_login(self.user)

        for path in ("settings/", "orders/", "administration/", "12345/"):
            with self.subTest(path=path):
                # Test Action
                response = self.client.get(f"{reverse('bpforge:react_base')}{path}")

                # Expected Result
                self.assertEqual(response.status_code, HTTPStatus.OK)
                self.assertTemplateUsed(response, "bpforge/react_base.html")

    def test_react_base_should_redirect_to_login_when_anonymous(self):
        # Test Action
        response = self.client.get(reverse("bpforge:react_base"))

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FOUND)
        self.assertTemplateNotUsed(response, "bpforge/react_base.html")

    def test_react_base_should_deny_user_without_basic_access(self):
        # Test Data
        no_access = UserMainFactory(permissions__=[])
        self.assertFalse(no_access.has_perm("bpforge.basic_access"))
        self.client.force_login(no_access)

        for path in ("", "settings/", "orders/", "administration/", "12345/"):
            with self.subTest(path=path):
                # Test Action
                response = self.client.get(f"{reverse('bpforge:react_base')}{path}")

                # Expected Result
                self.assertEqual(response.status_code, HTTPStatus.FOUND)
                self.assertTemplateNotUsed(response, "bpforge/react_base.html")

    def test_react_base_should_deny_user_with_only_higher_permissions(self):
        # Test Data
        no_basic = UserMainFactory(
            permissions=["bpforge.manage_access", "bpforge.full_access"]
        )
        self.assertTrue(no_basic.has_perm("bpforge.full_access"))
        self.assertFalse(no_basic.has_perm("bpforge.basic_access"))
        self.client.force_login(no_basic)

        # Test Action
        response = self.client.get(reverse("bpforge:react_base"))

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.FOUND)
        self.assertTemplateNotUsed(response, "bpforge/react_base.html")

    def test_react_base_should_not_fail_for_user_without_main_character(self):
        # Test Data
        no_main = UserFactory(permissions=["bpforge.basic_access"])
        self.assertTrue(no_main.has_perm("bpforge.basic_access"))
        self.assertIsNone(no_main.profile.main_character)

        # Test Action: the view itself does not need a main character
        request = self.factory.get(reverse("bpforge:react_base"))
        request.user = no_main
        response = react_base(request)

        # Expected Result
        self.assertEqual(response.status_code, HTTPStatus.OK)

        # Test Action: through the URLs, Alliance Auth sends the user to the dashboard
        self.client.force_login(no_main)
        response = self.client.get(reverse("bpforge:react_base"))

        # Expected Result
        self.assertRedirects(
            response,
            reverse("authentication:dashboard"),
            fetch_redirect_response=False,
        )

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
