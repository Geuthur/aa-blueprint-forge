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
            if not request.user.has_perm("bpforge.basic_access"):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            user_owners = Owner.objects.filter(user=request.user)

            # pylint: disable=duplicate-code
            blueprints = (
                Blueprint.objects.filter(owner__in=user_owners)
                .select_related(
                    "eve_type__group",
                    "location",
                    "owner__character__character",
                    "owner__corporation",
                )
                .order_by("eve_type__name")
            )

            # pylint: disable=duplicate-code
            result: list[schema.BlueprintItemSchema] = []
            for bp in blueprints:
                owner = bp.owner
                owner_name = (
                    owner.corporation.corporation_name
                    if owner.corporation
                    else (
                        owner.character.character.character_name
                        if owner.character
                        else owner.user.username
                    )
                )

                result.append(
                    schema.BlueprintItemSchema(
                        item_id=bp.item_id,
                        type_id=bp.eve_type_id,
                        type_name=bp.eve_type.name,
                        group_name=bp.eve_type.group.name if bp.eve_type.group else "",
                        is_original=bp.is_original,
                        is_corp_bp=bp.is_corp_bp,
                        runs=bp.runs,
                        quantity=bp.quantity,
                        material_efficiency=bp.material_efficency,
                        time_efficiency=bp.time_efficiency,
                        location_id=bp.location_id,
                        location_name=bp.location.name if bp.location else "",
                        owner_id=owner.id,
                        owner_name=owner_name,
                    )
                )

            return HTTPStatus.OK, result
