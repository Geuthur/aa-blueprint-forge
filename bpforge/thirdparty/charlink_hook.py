# Third Party
from charlink.app_imports.utils import AppImport, LoginImport

# Django
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Exists, OuterRef
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext_lazy as _

# Alliance Auth
from allianceauth.authentication.models import CharacterOwnership, Permission, User
from allianceauth.eveonline.models import EveCharacter, EveCorporationInfo

# AA Blueprint Forge
from bpforge.app_settings import BPFORGE_APP_NAME
from bpforge.models.blueprint import Owner
from bpforge.tasks import update_owner

_corp_perms = [
    "bpforge.manage_access",
]


# pylint: disable=unused-argument
def _add_character(request, token):
    character = get_object_or_404(EveCharacter, character_id=token.character_id)
    characterowner = Owner.objects.update_or_create(
        user=request.user,
        character=CharacterOwnership.objects.get(
            user=request.user, character=character
        ),
    )[0]
    update_owner.apply_async(
        kwargs={"owner_pk": characterowner.pk, "force_refresh": True}, priority=6
    )


# pylint: disable=unused-argument
def _add_character_corp(request, token):
    character = get_object_or_404(EveCharacter, character_id=token.character_id)
    try:
        corporation = EveCorporationInfo.objects.get(
            corporation_id=character.corporation_id
        )
    except ObjectDoesNotExist:
        corporation = EveCorporationInfo.objects.create_corporation(
            character.corporation_id
        )

    characterowner = Owner.objects.update_or_create(
        user=request.user,
        corporation=corporation,
        character=CharacterOwnership.objects.get(
            user=request.user, character=character
        ),
    )[0]
    update_owner.apply_async(
        kwargs={"owner_pk": characterowner.pk, "force_refresh": True}, priority=6
    )


def _check_perms_corp(user: User):
    return any(user.has_perm(perm) for perm in _corp_perms)


def _is_character_added(character: EveCharacter):
    return Owner.objects.filter(character__character=character).exists()


def _is_character_added_corp(character: EveCharacter):
    return Owner.objects.filter(
        corporation__corporation_id=character.corporation_id
    ).exists()


def _users_with_perms_char():
    permission = Permission.objects.get(
        content_type__app_label="bpforge", codename="basic_access"
    )
    # Use Alliance Auth's User model to get users with the permission, including those in groups and superusers (Fix Issue with Proxy Model)
    user_model = permission.user_set.model

    users_qs = (
        permission.user_set.all()
        | user_model.objects.filter(
            groups__in=list(permission.group_set.values_list("pk", flat=True))
        )
        | user_model.objects.select_related("profile").filter(
            profile__state__in=list(permission.state_set.values_list("pk", flat=True))
        )
        | user_model.objects.filter(is_superuser=True)
    )
    return users_qs.distinct()


def _users_with_perms_corp():
    permission = Permission.objects.get(
        content_type__app_label=_corp_perms[0].split(".", maxsplit=1)[0],
        codename=_corp_perms[0].split(".", maxsplit=1)[1],
    )
    # Use Alliance Auth's User model to get users with the permission, including those in groups and superusers (Fix Issue with Proxy Model)
    user_model = permission.user_set.model

    users_qs = (
        permission.user_set.all()
        | user_model.objects.filter(
            groups__in=list(permission.group_set.values_list("pk", flat=True))
        )
        | user_model.objects.select_related("profile").filter(
            profile__state__in=list(permission.state_set.values_list("pk", flat=True))
        )
        | user_model.objects.filter(is_superuser=True)
    )
    users = users_qs.distinct()

    for perm_str in _corp_perms[1:]:
        permission = Permission.objects.get(
            content_type__app_label=perm_str.split(".", maxsplit=1)[0],
            codename=perm_str.split(".", maxsplit=1)[1],
        )
        user_model = permission.user_set.model

        users_qs = (
            permission.user_set.all()
            | user_model.objects.filter(
                groups__in=list(permission.group_set.values_list("pk", flat=True))
            )
            | user_model.objects.select_related("profile").filter(
                profile__state__in=list(
                    permission.state_set.values_list("pk", flat=True)
                )
            )
            | user_model.objects.filter(is_superuser=True)
        )
        users |= users_qs.distinct()
    return users


app_import = AppImport(
    "bpforge",
    [
        LoginImport(
            app_label="bpforge",
            unique_id="default",
            field_label=_("Character") + " " + BPFORGE_APP_NAME,
            add_character=_add_character,
            scopes=Owner.get_character_scopes(),
            check_permissions=lambda user: user.has_perm("bpforge.basic_access"),
            is_character_added=_is_character_added,
            is_character_added_annotation=Exists(
                Owner.objects.filter(character__character=OuterRef("pk"))
            ),
            get_users_with_perms=_users_with_perms_char,
        ),
        LoginImport(
            app_label="bpforge",
            unique_id="corporation",
            field_label=_("Corporation") + " " + BPFORGE_APP_NAME,
            add_character=_add_character_corp,
            scopes=Owner.get_corporation_scopes(),
            check_permissions=_check_perms_corp,
            is_character_added=_is_character_added_corp,
            is_character_added_annotation=Exists(
                Owner.objects.filter(
                    corporation__corporation_id=OuterRef("corporation_id")
                )
            ),
            get_users_with_perms=_users_with_perms_corp,
            default_initial_selection=False,
        ),
    ],
)
