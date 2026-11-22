"""API endpoints for public blueprints and blueprint catalog."""

# Standard Library
from http import HTTPStatus

# Third Party
from ninja import NinjaAPI

# Django
from django.db.models import Count, Q
from django.utils.translation import gettext as _

# AA Blueprint Forge
from bpforge.api import schema
from bpforge.api.helpers import get_owner_or_error
from bpforge.models.blueprint import Blueprint, Owner


class ApiEndpoints:
    tags = ["Shop"]

    # pylint: disable=too-many-statements
    def __init__(self, api: NinjaAPI):
        @api.get(
            "blueprints/",
            response={
                HTTPStatus.OK: list[schema.OwnerPublicSchema],
                HTTPStatus.FORBIDDEN: schema.ErrorSchema,
            },
            tags=self.tags,
            summary="List all public blueprint owners",
        )
        def list_public_blueprints(request):  # pylint: disable=unused-argument
            bpo_filter = Q(bpforge_blueprints__runs__isnull=True) | Q(
                bpforge_blueprints__runs=0
            )
            bpc_filter = Q(bpforge_blueprints__runs__gt=0)

            # Query public owners with blueprint counts
            owners = (
                Owner.objects.filter(is_public=True)
                .select_related(
                    "character__character",
                    "corporation",
                )
                .annotate(
                    blueprint_count=Count("bpforge_blueprints", distinct=True),
                    bpo_count=Count(
                        "bpforge_blueprints",
                        filter=bpo_filter,
                        distinct=True,
                    ),
                    bpc_count=Count(
                        "bpforge_blueprints",
                        filter=bpc_filter,
                        distinct=True,
                    ),
                    selective_bpo_count=Count(
                        "bpforge_blueprints",
                        filter=bpo_filter & Q(bpforge_blueprints__is_offered=True),
                        distinct=True,
                    ),
                )
            )

            error_owner_ids = set(
                Owner.objects.filter(
                    Q(bpforge_update_status__is_success=False)
                    | Q(bpforge_update_status__has_token_error=True)
                ).values_list("id", flat=True)
            )

            result: list[schema.OwnerPublicSchema] = []
            for owner in owners:
                if owner.corporation:
                    name = owner.corporation.corporation_name
                    is_corp = True
                    char_id = None
                    corp_id = owner.corporation.corporation_id
                    alliance_id = (
                        owner.corporation.alliance.alliance_id
                        if owner.corporation.alliance
                        else None
                    )
                elif owner.character:
                    name = owner.character.character.character_name
                    is_corp = False
                    char_id = owner.character.character.character_id
                    corp_id = owner.character.character.corporation_id
                    alliance_id = owner.character.character.alliance_id
                else:
                    name = owner.user.username
                    is_corp = False
                    char_id = None
                    corp_id = None
                    alliance_id = None

                # Calculate counts based on public_type and selective_bpo_enabled
                if owner.public_type == "bpc":
                    effective_bpo = 0
                    effective_bpc = owner.bpc_count
                elif owner.public_type == "bpo":
                    effective_bpc = 0
                    if owner.selective_bpo_enabled:
                        effective_bpo = owner.selective_bpo_count
                    else:
                        effective_bpo = owner.bpo_count
                else:
                    effective_bpc = owner.bpc_count
                    if owner.selective_bpo_enabled:
                        effective_bpo = owner.selective_bpo_count
                    else:
                        effective_bpo = owner.bpo_count

                result.append(
                    schema.OwnerPublicSchema(
                        id=owner.id,
                        name=name,
                        is_corporation=is_corp,
                        character_id=char_id,
                        corporation_id=corp_id,
                        alliance_id=alliance_id,
                        blueprint_count=effective_bpo + effective_bpc,
                        bpo_count=effective_bpo,
                        bpc_count=effective_bpc,
                        has_errors=(owner.id in error_owner_ids),
                    )
                )

            return HTTPStatus.OK, result

        @api.get(
            "blueprints/search/",
            response={
                HTTPStatus.OK: list[schema.BlueprintItemSchema],
                HTTPStatus.FORBIDDEN: schema.ErrorSchema,
            },
            tags=self.tags,
            summary="Search all public blueprints",
        )
        def search_public_blueprints(
            request, q: str = ""
        ):  # pylint: disable=unused-argument
            query = q.strip()
            if not query:
                return HTTPStatus.OK, []

            blueprint_qs = (
                Blueprint.objects.with_api_relations()
                .filter(owner__is_public=True)
                .filter(
                    Q(eve_type__name__icontains=query)
                    | Q(eve_type__group__name__icontains=query)
                )
                .in_catalog()
                .order_by("eve_type__name")[:250]
            )

            result = [
                schema.BlueprintItemSchema.from_blueprint(bp, include_location=False)
                for bp in blueprint_qs
            ]
            return HTTPStatus.OK, result

        @api.get(
            "blueprints/{int:owner_id}/",
            response={
                HTTPStatus.OK: list[schema.BlueprintItemSchema],
                HTTPStatus.FORBIDDEN: schema.ErrorSchema,
                HTTPStatus.NOT_FOUND: schema.ErrorSchema,
            },
            tags=self.tags,
            summary="List blueprints for a specific owner",
        )
        def list_owner_blueprints(request, owner_id: int):
            owner, error = get_owner_or_error(
                Owner.objects.visible_to(request.user).select_related(
                    "character__character", "corporation"
                ),
                owner_id,
                _("This blueprint catalog is private."),
            )
            if error:
                return error

            # The catalog follows the settings of the owner, also for the owner and admins
            blueprints = (
                Blueprint.objects.with_catalog_relations()
                .filter(owner=owner)
                .in_catalog()
                .order_by("eve_type__name")
            )

            result = [
                schema.BlueprintItemSchema.from_blueprint(bp, include_location=False)
                for bp in blueprints
            ]
            return HTTPStatus.OK, result
