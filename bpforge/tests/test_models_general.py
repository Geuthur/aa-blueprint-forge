"""Tests for the General model permission helpers."""

# Django
from django.contrib.auth.models import AnonymousUser

# AA Blueprint Forge
from bpforge.models.general import General
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory


class TestGeneralPermissions(AuthTestCase):
    def test_get_perm_should_return_full_permission_string_for_enum(self):
        # Test Data
        perm = General.Permission.BASIC_ACCESS

        # Test Action
        result = General.get_perm(perm)

        # Expected Result
        self.assertEqual(result, "bpforge.basic_access")

    def test_get_perm_should_return_full_permission_string_for_codename(self):
        # Test Data
        codename = "full_access"

        # Test Action
        result = General.get_perm(codename)

        # Expected Result
        self.assertEqual(result, "bpforge.full_access")

    def test_meta_permissions_should_match_permission_choices(self):
        # Test Data
        codenames = {codename for codename, _ in General._meta.permissions}

        # Test Action
        expected = {"basic_access", "manage_access", "full_access"}

        # Expected Result
        self.assertEqual(codenames, expected)

    def test_has_perm_should_return_false_for_none_user(self):
        # Test Data
        user = None

        # Test Action
        result = General.has_perm(user, General.Permission.BASIC_ACCESS)

        # Expected Result
        self.assertFalse(result)

    def test_has_perm_should_return_false_for_anonymous_user(self):
        # Test Data
        user = AnonymousUser()

        # Test Action
        result = General.has_perm(user, General.Permission.BASIC_ACCESS)

        # Expected Result
        self.assertFalse(result)

    def test_has_perm_should_return_true_for_superuser(self):
        # Test Data
        user = self.superuser

        # Test Action
        result = General.has_perm(user, General.Permission.FULL_ACCESS)

        # Expected Result
        self.assertTrue(result)

    def test_has_perm_should_return_true_for_user_with_permission(self):
        # Test Data
        user = UserMainFactory(permissions__=["bpforge.manage_access"])

        # Test Action
        result = General.has_perm(user, General.Permission.MANAGE_ACCESS)

        # Expected Result
        self.assertTrue(result)

    def test_has_perm_should_return_false_for_user_without_permission(self):
        # Test Data
        user = UserMainFactory()

        # Test Action
        result = General.has_perm(user, General.Permission.FULL_ACCESS)

        # Expected Result
        self.assertFalse(result)

    def test_has_any_perm_should_return_true_if_one_permission_matches(self):
        # Test Data
        user = UserMainFactory(permissions__=["bpforge.manage_access"])

        # Test Action
        result = General.has_any_perm(
            user, General.Permission.FULL_ACCESS, General.Permission.MANAGE_ACCESS
        )

        # Expected Result
        self.assertTrue(result)

    def test_has_any_perm_should_return_false_if_no_permission_matches(self):
        # Test Data
        user = UserMainFactory()

        # Test Action
        result = General.has_any_perm(
            user, General.Permission.FULL_ACCESS, General.Permission.MANAGE_ACCESS
        )

        # Expected Result
        self.assertFalse(result)

    def test_has_any_perm_should_return_false_for_none_user(self):
        # Test Data
        user = None

        # Test Action
        result = General.has_any_perm(user, General.Permission.BASIC_ACCESS)

        # Expected Result
        self.assertFalse(result)
