"""Helpers shared by the API endpoints."""

# Standard Library
from http import HTTPStatus

# Django
from django.db.models import QuerySet
from django.utils.translation import gettext as _

# AA Blueprint Forge
from bpforge.models.blueprint import Owner


def get_owner_or_error(queryset: QuerySet, owner_id: int, forbidden_message: str):
    """
    Get an owner from a queryset that is already restricted to the user.

    Pass `Owner.objects.visible_to(user)` or `Owner.objects.manage_to(user)`,
    with any `select_related` or annotation the endpoint needs.

    Returns:
        `(owner, None)`, or `(None, (status, body))` with 404 when the owner
        does not exist and 403 with `forbidden_message` when the user has no
        access to it.
    """
    owner = queryset.filter(id=owner_id).first()
    if owner is not None:
        return owner, None
    if Owner.objects.filter(id=owner_id).exists():
        return None, (HTTPStatus.FORBIDDEN, {"error": forbidden_message})
    return None, (HTTPStatus.NOT_FOUND, {"error": _("Owner not found.")})
