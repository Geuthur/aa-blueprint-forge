"""PvE Views"""

# Django
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ObjectDoesNotExist
from django.core.handlers.wsgi import WSGIRequest
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

# Alliance Auth
from allianceauth.authentication.models import CharacterOwnership
from allianceauth.eveonline.models import EveCharacter, EveCorporationInfo
from allianceauth.services.hooks import get_extension_logger
from esi.decorators import token_required
from esi.models import Token

# AA Blueprint Forge
from bpforge import __app_name__, __title__, __version__
from bpforge.models.blueprint import Owner
from bpforge.providers import AppLogger
from bpforge.tasks import update_owner

logger = AppLogger(get_extension_logger(__name__), __title__)


@login_required
def react_base(request: WSGIRequest, character_id=None):  #
    if character_id is None:
        character_id = request.user.profile.main_character.character_id

    context = {
        "version": __version__,
        "app_name": __app_name__,
        "character_id": character_id,
    }
    return render(request, "bpforge/react_base.html", context=context)


@login_required
@token_required(scopes=Owner.get_corporation_scopes())
def add_corporation(request: WSGIRequest, token: Token):
    """Add Corporation"""
    character = get_object_or_404(EveCharacter, character_id=token.character_id)

    # Check if it is a NPC Corporation
    if not character.corporation_id or character.corporation_id < 10_000_000:
        msg = _("Cannot add NPC Corporation to Blueprint Forge")
        messages.error(request, msg)
        return redirect("bpforge:react_base")

    try:
        characterowner = CharacterOwnership.objects.get(
            user=request.user, character=character
        )
    except ObjectDoesNotExist:
        messages.error(
            request, _(f"{character.character_name} is not linked to your account")
        )
        return redirect(f"{reverse('bpforge:react_base')}settings/")

    try:
        corporation = EveCorporationInfo.objects.get(
            corporation_id=character.corporation_id
        )
    except ObjectDoesNotExist:
        corporation = EveCorporationInfo.objects.create_corporation(
            character.corporation_id
        )

    with transaction.atomic():
        owner = Owner.objects.update_or_create(
            user=request.user,
            corporation=corporation,
            character=characterowner,
        )[0]

    update_owner.delay(owner.pk)
    messages.info(
        request,
        _(
            f"{owner.corporation.corporation_name} has been added with {character.character_name} as sync character."
        ),
    )
    return redirect(f"{reverse('bpforge:react_base')}settings/")


@login_required
@token_required(scopes=Owner.get_character_scopes())
def add_character(request: WSGIRequest, token: Token):
    """Add Character"""
    character = get_object_or_404(EveCharacter, character_id=token.character_id)
    try:
        characterowner = CharacterOwnership.objects.get(
            user=request.user, character=character
        )
    except ObjectDoesNotExist:
        messages.error(
            request, _(f"{character.character_name} is not linked to your account")
        )
        return redirect(f"{reverse('bpforge:react_base')}settings/")

    with transaction.atomic():
        owner = Owner.objects.update_or_create(
            user=request.user,
            corporation=None,
            character=characterowner,
        )[0]

    update_owner.delay(owner.pk)
    messages.info(
        request,
        _(f"{character.character_name} has been added as personal owner."),
    )
    return redirect(f"{reverse('bpforge:react_base')}settings/")
