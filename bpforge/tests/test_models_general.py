"""Tests for the General model permission helpers."""

# Django
from django.contrib.auth.models import AnonymousUser

# AA Blueprint Forge
from bpforge.models.general import General, GeneralNotificationSettings
from bpforge.models.request import Order
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
from bpforge.tests.testdata.bpforge import GroupFactory, OrderFactory, OwnerFactory
from bpforge.tests.testdata.factory import (
    EveCharacterFactory,
    EveCorporationInfoFactory,
)


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


class TestGeneralOrderAccess(AuthTestCase):
    @staticmethod
    def _user_in_corp(corporation, **kwargs):
        return UserMainFactory(
            main_character__character=EveCharacterFactory(corporation=corporation),
            **kwargs,
        )

    @staticmethod
    def _global_manager_group():
        group = GroupFactory()
        GeneralNotificationSettings.get_solo().order_status_groups.add(group)
        return group

    # has_administration_access
    def test_has_administration_access_should_return_true_with_full_access(self):
        # Test Data
        user = UserMainFactory(permissions__=["bpforge.full_access"])

        # Test Action
        result = General.has_administration_access(user)

        # Expected Result
        self.assertTrue(result)

    def test_has_administration_access_should_return_false_without_full_access(self):
        # Test Data
        user = UserMainFactory(permissions__=["bpforge.manage_access"])

        # Test Action
        result = General.has_administration_access(user)

        # Expected Result
        self.assertFalse(result)

    def test_has_administration_access_should_return_false_for_none_user(self):
        # Test Data
        user = None

        # Test Action
        result = General.has_administration_access(user)

        # Expected Result
        self.assertFalse(result)

    # get_user_corporation_ids
    def test_get_user_corporation_ids_should_return_main_corporation(self):
        # Test Data
        corporation = EveCorporationInfoFactory()
        user = self._user_in_corp(corporation)

        # Test Action
        result = General.get_user_corporation_ids(user)

        # Expected Result
        self.assertIn(corporation.corporation_id, result)

    def test_get_user_corporation_ids_should_return_empty_set_for_user_without_characters(
        self,
    ):
        # Test Data
        user = UserMainFactory()
        user.character_ownerships.all().delete()

        # Test Action
        result = General.get_user_corporation_ids(user)

        # Expected Result
        self.assertEqual(result, set())

    # is_global_order_manager
    def test_is_global_order_manager_should_return_false_for_none_user(self):
        # Test Data
        user = None

        # Test Action
        result = General.is_global_order_manager(user)

        # Expected Result
        self.assertFalse(result)

    def test_is_global_order_manager_should_return_false_for_anonymous_user(self):
        # Test Data
        user = AnonymousUser()

        # Test Action
        result = General.is_global_order_manager(user)

        # Expected Result
        self.assertFalse(result)

    def test_is_global_order_manager_should_return_true_with_full_access(self):
        # Test Data
        user = UserMainFactory(permissions__=["bpforge.full_access"])

        # Test Action
        result = General.is_global_order_manager(user)

        # Expected Result
        self.assertTrue(result)

    def test_is_global_order_manager_should_return_true_for_notification_group_member(
        self,
    ):
        # Test Data
        user = UserMainFactory()
        user.groups.add(self._global_manager_group())

        # Test Action
        result = General.is_global_order_manager(user)

        # Expected Result
        self.assertTrue(result)

    def test_is_global_order_manager_should_return_false_for_regular_user(self):
        # Test Data
        user = UserMainFactory(permissions__=["bpforge.manage_access"])
        user.groups.add(GroupFactory())

        # Test Action
        result = General.is_global_order_manager(user)

        # Expected Result
        self.assertFalse(result)

    # is_corp_order_manager
    def test_is_corp_order_manager_should_return_false_for_none_user(self):
        # Test Data
        user = None

        # Test Action
        result = General.is_corp_order_manager(user)

        # Expected Result
        self.assertFalse(result)

    def test_is_corp_order_manager_should_return_true_with_manage_access(self):
        # Test Data
        user = UserMainFactory(permissions__=["bpforge.manage_access"])

        # Test Action
        result = General.is_corp_order_manager(user)

        # Expected Result
        self.assertTrue(result)

    def test_is_corp_order_manager_should_return_false_without_manage_access(self):
        # Test Data
        user = UserMainFactory()

        # Test Action
        result = General.is_corp_order_manager(user)

        # Expected Result
        self.assertFalse(result)

    # can_manage_orders
    def test_can_manage_orders_should_return_true_for_global_manager(self):
        # Test Data
        user = UserMainFactory(permissions__=["bpforge.full_access"])

        # Test Action
        result = General.can_manage_orders(user)

        # Expected Result
        self.assertTrue(result)

    def test_can_manage_orders_should_return_true_for_corp_manager(self):
        # Test Data
        user = UserMainFactory(permissions__=["bpforge.manage_access"])

        # Test Action
        result = General.can_manage_orders(user)

        # Expected Result
        self.assertTrue(result)

    def test_can_manage_orders_should_return_false_for_regular_user(self):
        # Test Data
        user = UserMainFactory()

        # Test Action
        result = General.can_manage_orders(user)

        # Expected Result
        self.assertFalse(result)

    # can_manage_order
    def test_can_manage_order_should_return_true_for_global_manager(self):
        # Test Data
        user = UserMainFactory(permissions__=["bpforge.full_access"])
        order = OrderFactory()

        # Test Action
        result = General.can_manage_order(user, order)

        # Expected Result
        self.assertTrue(result)

    def test_can_manage_order_should_return_false_for_regular_user(self):
        # Test Data
        user = UserMainFactory()
        order = OrderFactory()

        # Test Action
        result = General.can_manage_order(user, order)

        # Expected Result
        self.assertFalse(result)

    def test_can_manage_order_should_return_true_for_corp_manager_of_seller_corp(self):
        # Test Data
        corporation = EveCorporationInfoFactory()
        manager = self._user_in_corp(
            corporation, permissions__=["bpforge.manage_access"]
        )
        seller = self._user_in_corp(corporation)
        order = OrderFactory(owner=OwnerFactory(user=seller))

        # Test Action
        result = General.can_manage_order(manager, order)

        # Expected Result
        self.assertTrue(result)

    def test_can_manage_order_should_return_true_for_corp_manager_of_buyer_corp(self):
        # Test Data
        corporation = EveCorporationInfoFactory()
        manager = self._user_in_corp(
            corporation, permissions__=["bpforge.manage_access"]
        )
        buyer = self._user_in_corp(corporation)
        order = OrderFactory(requesting_user=buyer)

        # Test Action
        result = General.can_manage_order(manager, order)

        # Expected Result
        self.assertTrue(result)

    def test_can_manage_order_should_return_false_for_corp_manager_of_other_corp(self):
        # Test Data
        manager = self._user_in_corp(
            EveCorporationInfoFactory(), permissions__=["bpforge.manage_access"]
        )
        order = OrderFactory()

        # Test Action
        result = General.can_manage_order(manager, order)

        # Expected Result
        self.assertFalse(result)

    # get_manageable_orders_filter
    def test_get_manageable_orders_filter_should_return_none_for_regular_user(self):
        # Test Data
        user = UserMainFactory()

        # Test Action
        result = General.get_manageable_orders_filter(user)

        # Expected Result
        self.assertIsNone(result)

    def test_get_manageable_orders_filter_should_return_all_orders_for_global_manager(
        self,
    ):
        # Test Data
        user = UserMainFactory(permissions__=["bpforge.full_access"])
        order1 = OrderFactory()
        order2 = OrderFactory()

        # Test Action
        result = General.get_manageable_orders_filter(user)

        # Expected Result
        ids = set(Order.objects.filter(result).values_list("id", flat=True))
        self.assertTrue({order1.id, order2.id} <= ids)

    def test_get_manageable_orders_filter_should_return_only_corp_orders_for_corp_manager(
        self,
    ):
        # Test Data
        corporation = EveCorporationInfoFactory()
        manager = self._user_in_corp(
            corporation, permissions__=["bpforge.manage_access"]
        )
        buyer = self._user_in_corp(corporation)
        order_corp = OrderFactory(requesting_user=buyer)
        order_other = OrderFactory()

        # Test Action
        result = General.get_manageable_orders_filter(manager)

        # Expected Result
        ids = set(Order.objects.filter(result).values_list("id", flat=True))
        self.assertIn(order_corp.id, ids)
        self.assertNotIn(order_other.id, ids)
