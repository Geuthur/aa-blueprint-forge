# Third Party
import factory

# AA Blueprint Forge
from bpforge import __app_name__
from bpforge.tests.testdata.factory import (
    EveCharacterFactory,
    UserFactory,
)
from bpforge.tests.testdata.utils import add_character_to_user


class UserMainFactory(UserFactory):
    """Generate a User object with a main character and default permissions for Alliance Auth."""

    permissions__ = [f"{__app_name__}.basic_access"]
    scopes__ = ["publicData"]

    @factory.post_generation
    def main_character(obj, create, _, **kwargs):
        if not create:
            return
        if "character" in kwargs:
            character = kwargs["character"]
        else:
            character_name = f"{obj.first_name} {obj.last_name}"
            character = EveCharacterFactory(character_name=character_name)

        add_character_to_user(
            user=obj,
            character=character,
            is_main=True,
            scopes=obj._main_character_scopes,
        )
