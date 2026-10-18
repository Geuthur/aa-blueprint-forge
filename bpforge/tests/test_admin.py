"""Tests for bpforge Django admin site."""

# Standard Library
from http import HTTPStatus
from unittest.mock import patch

# Django
from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage

# Alliance Auth
from allianceauth.authentication.models import User

# AA Blueprint Forge
from bpforge.admin import OwnerAdmin, OwnerUpdateStatusAdminInline
from bpforge.models.blueprint import Owner, OwnerPublicType, OwnerUpdateStatus
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
from bpforge.tests.testdata.bpforge import OwnerFactory


class DummyAdminSite(AdminSite):
    pass


class TestOwnerAdmin(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.site = DummyAdminSite()
        self.admin = OwnerAdmin(Owner, self.site)
        self.owner_user = UserMainFactory()
        self.owner = OwnerFactory(
            user=self.owner_user,
            is_public=True,
            public_type=OwnerPublicType.ALL,
        )

    def test_admin_permissions_should_allow_superuser_and_deny_add(self):
        # Test Data
        self.user.is_superuser = True
        self.user.save()
        request = self.factory.get("/")
        request.user = self.user

        # Test Action & Expected Result
        self.assertFalse(self.admin.has_add_permission(request))
        self.assertTrue(self.admin.has_change_permission(request, self.owner))
        self.assertTrue(self.admin.has_delete_permission(request, self.owner))
        self.assertTrue(self.admin.has_module_permission(request))

    def test_admin_permissions_should_deny_non_superuser(self):
        # Test Data
        self.user.is_superuser = False
        self.user.save()
        request = self.factory.get("/")
        request.user = self.user

        # Test Action & Expected Result
        self.assertFalse(self.admin.has_add_permission(request))
        self.assertFalse(self.admin.has_change_permission(request, self.owner))
        self.assertFalse(self.admin.has_delete_permission(request, self.owner))
        self.assertFalse(self.admin.has_module_permission(request))

    @patch("bpforge.admin.update_owner.delay")
    def test_force_update_selected_owners_action_should_queue_task(self, mock_delay):
        # Test Data
        self.user.is_superuser = True
        self.user.save()
        request = self.factory.post("/")
        request.user = self.user
        setattr(request, "session", "session")
        messages = FallbackStorage(request)
        setattr(request, "_messages", messages)
        queryset = Owner.objects.filter(pk=self.owner.pk)

        # Test Action
        self.admin.force_update_selected_owners(request, queryset)

        # Expected Result
        mock_delay.assert_called_once_with(owner_pk=self.owner.pk, force_refresh=True)

    @patch("bpforge.admin.update_owner.delay")
    def test_update_selected_owners_action_should_queue_task(self, mock_delay):
        # Test Data
        self.user.is_superuser = True
        self.user.save()
        request = self.factory.post("/")
        request.user = self.user
        setattr(request, "session", "session")
        messages = FallbackStorage(request)
        setattr(request, "_messages", messages)
        queryset = Owner.objects.filter(pk=self.owner.pk)

        # Test Action
        self.admin.update_selected_owners(request, queryset)

        # Expected Result
        mock_delay.assert_called_once_with(owner_pk=self.owner.pk, force_refresh=False)

    @patch("bpforge.admin.update_owner.delay")
    def test_force_update_owner_view_should_queue_task_and_redirect(self, mock_delay):
        # Test Data
        self.user.is_superuser = True
        self.user.save()
        request = self.factory.get(
            f"/admin/bpforge/owner/{self.owner.pk}/force-update/"
        )
        request.user = self.user
        setattr(request, "session", "session")
        messages = FallbackStorage(request)
        setattr(request, "_messages", messages)

        # Test Action
        response = self.admin.force_update_owner_view(request, self.owner.pk)

        # Expected Result
        mock_delay.assert_called_once_with(owner_pk=self.owner.pk, force_refresh=True)
        self.assertEqual(response.status_code, HTTPStatus.FOUND)

    def test_display_helpers_should_return_formatted_values(self):
        # Test Data
        request = self.factory.get("/")
        request.user = self.user

        # Test Action
        name = self.admin._name(self.owner)
        owner_type = self.admin._owner_type(self.owner)
        count = self.admin._blueprint_count(self.owner)
        pic = self.admin._entity_pic(self.owner)
        last_update = self.admin._last_update_at(self.owner)

        # Expected Result
        self.assertEqual(name, self.owner.name)
        self.assertIn("img", pic)
        self.assertIn(owner_type, ["Corporation", "Character"])
        self.assertEqual(count, 0)
        self.assertEqual(last_update, "-")

    def test_inline_permissions_should_deny_add_change_delete(self):
        # Test Data
        inline = OwnerUpdateStatusAdminInline(OwnerUpdateStatus, self.site)
        request = self.factory.get("/")
        request.user = self.user

        # Test Action & Expected Result
        self.assertFalse(inline.has_add_permission(request))
        self.assertFalse(inline.has_change_permission(request))
        self.assertFalse(inline.has_delete_permission(request))
