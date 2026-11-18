# Standard Library
import importlib
import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

# AA Blueprint Forge
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
from bpforge.tests.testdata.bpforge import GroupFactory


class TestCharlinkHookPermissions(AuthTestCase):
    """charlink is an optional package, so the tests load the hook with a stub of it."""

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        utils = ModuleType("charlink.app_imports.utils")
        utils.AppImport = lambda app, imports: SimpleNamespace(imports=imports)
        utils.LoginImport = lambda **kwargs: SimpleNamespace(**kwargs)
        stubs = {
            "charlink": ModuleType("charlink"),
            "charlink.app_imports": ModuleType("charlink.app_imports"),
            "charlink.app_imports.utils": utils,
        }
        with patch.dict(sys.modules, stubs):
            sys.modules.pop("bpforge.thirdparty.charlink_hook", None)
            module = importlib.import_module("bpforge.thirdparty.charlink_hook")
        sys.modules.pop("bpforge.thirdparty.charlink_hook", None)
        imports = {imp.unique_id: imp for imp in module.app_import.imports}
        cls.character_import = imports["default"]
        cls.corporation_import = imports["corporation"]

        cls.no_permission = UserMainFactory(permissions=[])
        cls.manage_only = UserMainFactory(permissions=["bpforge.manage_access"])
        cls.full_only = UserMainFactory(permissions=["bpforge.full_access"])
        cls.manage_and_full = UserMainFactory(
            permissions=["bpforge.manage_access", "bpforge.full_access"]
        )
        cls.basic_and_manage = UserMainFactory(
            permissions=["bpforge.basic_access", "bpforge.manage_access"]
        )

    def test_character_import_should_require_basic_access(self):
        check = self.character_import.check_permissions

        self.assertTrue(check(self.user))
        self.assertTrue(check(self.basic_and_manage))
        self.assertTrue(check(self.superuser))
        for user in (
            self.no_permission,
            self.manage_only,
            self.full_only,
            self.manage_and_full,
        ):
            with self.subTest(user=user):
                self.assertFalse(check(user))

    def test_corporation_import_should_require_basic_and_manage_access(self):
        check = self.corporation_import.check_permissions

        self.assertTrue(check(self.basic_and_manage))
        self.assertTrue(check(self.superuser))
        for user in (
            self.user,
            self.no_permission,
            self.manage_only,
            self.full_only,
            self.manage_and_full,
        ):
            with self.subTest(user=user):
                self.assertFalse(check(user))

    def test_character_users_should_only_contain_users_with_basic_access(self):
        users = set(self.character_import.get_users_with_perms())

        self.assertEqual(users, {self.user, self.basic_and_manage, self.superuser})

    def test_corporation_users_should_only_contain_users_with_both_permissions(self):
        users = set(self.corporation_import.get_users_with_perms())

        self.assertEqual(users, {self.basic_and_manage, self.superuser})

    def test_corporation_users_should_respect_permissions_of_groups(self):
        # Test Data: `manage_access` through a group, `basic_access` directly
        group = GroupFactory(name="Charlink Corp Managers")
        manage = self.manage_only.user_permissions.get(codename="manage_access")
        group.permissions.add(manage)
        group_manager = UserMainFactory()
        group_manager.groups.add(group)
        group_only = UserMainFactory(permissions=[])
        group_only.groups.add(group)

        # Test Action
        users = set(self.corporation_import.get_users_with_perms())

        # Expected Result
        self.assertIn(group_manager, users)
        self.assertNotIn(group_only, users)
