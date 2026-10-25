"""API endpoints for user's own blueprints."""

# Standard Library
from http import HTTPStatus

# Third Party
from ninja import NinjaAPI

# Django
from django.utils.translation import gettext as _

# AA Blueprint Forge
from bpforge.api import schema
from bpforge.models.blueprint import Blueprint, Owner
from bpforge.models.general import General


class ApiEndpoints:
    tags = ["My Blueprints"]

    def __init__(self, api: NinjaAPI):
        @api.get(
            "my-blueprints/",
            response={
                HTTPStatus.OK: list[schema.BlueprintItemSchema],
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="List all blueprints owned by the current user across characters and corporations",
        )
        def list_my_blueprints(request):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            user_owners = Owner.objects.filter(user=request.user)

            blueprints = (
                Blueprint.objects.with_api_relations()
                .filter(owner__in=user_owners)
                .order_by("eve_type__name")
            )

            result = [
                schema.BlueprintItemSchema.from_blueprint(bp) for bp in blueprints
            ]
            return HTTPStatus.OK, result
