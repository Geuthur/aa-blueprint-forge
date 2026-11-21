"""Tests for the access rules of `AccessQuerySet` and `AccessManager`."""

# Third Party
from evesde_factory.allianceauth import EveCharacterFactory, UserFactory

# AA Blueprint Forge
from bpforge.models.blueprint import Blueprint, Owner
from bpforge.tests import AuthTestCase
from bpforge.tests.testdata.app import UserMainFactory
from bpforge.tests.testdata.bpforge import BlueprintFactory, OwnerFactory


class AccessTestCase(AuthTestCase):
    """One own, one foreign private and one foreign public owner with a blueprint each."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.admin = UserMainFactory(
            permissions__=["bpforge.basic_access", "bpforge.full_access"]
        )
        cls.no_main = UserFactory(permissions__=["bpforge.basic_access"])

        cls.own_owner = OwnerFactory(user=cls.user, is_public=False)
        cls.private_owner = OwnerFactory(is_public=False)
        cls.public_owner = OwnerFactory(is_public=True)

        cls.own_bp = BlueprintFactory(owner=cls.own_owner)
        cls.private_bp = BlueprintFactory(owner=cls.private_owner)
        cls.public_bp = BlueprintFactory(owner=cls.public_owner)


class TestOwnerAccess(AccessTestCase):
    def test_visible_to_should_return_own_and_public_owners(self):
        # Test Action
        result = Owner.objects.visible_to(self.user)

        # Expected Result
        self.assertCountEqual(result, [self.own_owner, self.public_owner])

    def test_manage_to_should_return_only_own_owners(self):
        # Test Action
        result = Owner.objects.manage_to(self.user)

        # Expected Result
        self.assertCountEqual(result, [self.own_owner])

    def test_visible_to_and_manage_to_should_return_all_for_full_access(self):
        # Test Data
        expected = [self.own_owner, self.private_owner, self.public_owner]

        # Test Action & Expected Result
        self.assertCountEqual(Owner.objects.visible_to(self.admin), expected)
        self.assertCountEqual(Owner.objects.manage_to(self.admin), expected)

    def test_visible_to_and_manage_to_should_return_all_for_superuser(self):
        # Test Data
        expected = [self.own_owner, self.private_owner, self.public_owner]

        # Test Action & Expected Result
        self.assertCountEqual(Owner.objects.visible_to(self.superuser), expected)
        self.assertCountEqual(Owner.objects.manage_to(self.superuser), expected)

    def test_visible_to_and_manage_to_should_return_nothing_without_main(self):
        # Test Action & Expected Result
        self.assertFalse(Owner.objects.visible_to(self.no_main).exists())
        self.assertFalse(Owner.objects.manage_to(self.no_main).exists())

    def test_visible_to_should_keep_earlier_filters(self):
        # Test Action
        result = Owner.objects.filter(is_public=False).visible_to(self.user)

        # Expected Result
        self.assertCountEqual(result, [self.own_owner])


class TestBlueprintAccess(AccessTestCase):
    def test_visible_to_should_return_blueprints_of_own_and_public_owners(self):
        # Test Action
        result = Blueprint.objects.visible_to(self.user)

        # Expected Result
        self.assertCountEqual(result, [self.own_bp, self.public_bp])

    def test_manage_to_should_return_only_blueprints_of_own_owners(self):
        # Test Action
        result = Blueprint.objects.manage_to(self.user)

        # Expected Result
        self.assertCountEqual(result, [self.own_bp])

    def test_visible_to_and_manage_to_should_return_all_for_full_access(self):
        # Test Data
        expected = [self.own_bp, self.private_bp, self.public_bp]

        # Test Action & Expected Result
        self.assertCountEqual(Blueprint.objects.visible_to(self.admin), expected)
        self.assertCountEqual(Blueprint.objects.manage_to(self.admin), expected)

    def test_visible_to_and_manage_to_should_return_all_for_superuser(self):
        # Test Data
        expected = [self.own_bp, self.private_bp, self.public_bp]

        # Test Action & Expected Result
        self.assertCountEqual(Blueprint.objects.visible_to(self.superuser), expected)
        self.assertCountEqual(Blueprint.objects.manage_to(self.superuser), expected)

    def test_visible_to_and_manage_to_should_return_nothing_without_main(self):
        # Test Action & Expected Result
        self.assertFalse(Blueprint.objects.visible_to(self.no_main).exists())
        self.assertFalse(Blueprint.objects.manage_to(self.no_main).exists())

    def test_visible_to_should_work_on_a_chained_queryset(self):
        # Test Action
        result = Blueprint.objects.with_api_relations().visible_to(self.user)

        # Expected Result
        self.assertCountEqual(result, [self.own_bp, self.public_bp])


class TestVisibleEveCharacters(AccessTestCase):
    def test_should_return_only_own_characters(self):
        # Test Data
        own = self.user.profile.main_character
        EveCharacterFactory()

        # Test Action
        result = Owner.objects.visible_eve_characters(self.user)

        # Expected Result
        self.assertCountEqual(result, [own])

    def test_should_return_all_characters_for_full_access_and_superuser(self):
        # Test Data
        foreign = EveCharacterFactory()

        # Test Action & Expected Result
        self.assertIn(foreign, Owner.objects.visible_eve_characters(self.admin))
        self.assertIn(foreign, Owner.objects.visible_eve_characters(self.superuser))

    def test_should_return_nothing_without_main(self):
        # Test Action & Expected Result
        self.assertFalse(Owner.objects.visible_eve_characters(self.no_main).exists())
