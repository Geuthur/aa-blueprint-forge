"""Tests for the GeneralManager permission rules."""

# Django
from django.contrib.auth.models import AnonymousUser

# AA Blueprint Forge
from bpforge.models.general import General
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory


class TestGeneralManager(AuthTestCase):
    def test_has_basic_access_should_follow_basic_access(self):
        with self.subTest("with permission"):
            user = UserMainFactory(permissions__=["bpforge.basic_access"])
            self.assertTrue(General.objects.has_basic_access(user))
        with self.subTest("without permission"):
            user = UserMainFactory(permissions__=["bpforge.manage_access"])
            self.assertFalse(General.objects.has_basic_access(user))
        with self.subTest("anonymous"):
            self.assertFalse(General.objects.has_basic_access(AnonymousUser()))
        with self.subTest("superuser"):
            self.assertTrue(General.objects.has_basic_access(self.superuser))

    def test_has_management_access_should_follow_manage_access_only(self):
        with self.subTest("with permission"):
            user = UserMainFactory(permissions__=["bpforge.manage_access"])
            self.assertTrue(General.objects.has_management_access(user))
        with self.subTest("full access alone does not grant it"):
            user = UserMainFactory(permissions__=["bpforge.full_access"])
            self.assertFalse(General.objects.has_management_access(user))
        with self.subTest("anonymous"):
            self.assertFalse(General.objects.has_management_access(AnonymousUser()))
        with self.subTest("superuser"):
            self.assertTrue(General.objects.has_management_access(self.superuser))

    def test_has_admin_access_should_follow_full_access(self):
        with self.subTest("with permission"):
            user = UserMainFactory(permissions__=["bpforge.full_access"])
            self.assertTrue(General.objects.has_admin_access(user))
        with self.subTest("without permission"):
            user = UserMainFactory(permissions__=["bpforge.manage_access"])
            self.assertFalse(General.objects.has_admin_access(user))
        with self.subTest("anonymous"):
            self.assertFalse(General.objects.has_admin_access(AnonymousUser()))
        with self.subTest("superuser"):
            self.assertTrue(General.objects.has_admin_access(self.superuser))
