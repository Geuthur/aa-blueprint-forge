"""API endpoints for public blueprints and blueprint catalog."""

# Standard Library
from http import HTTPStatus

# Third Party
from ninja import NinjaAPI

# Django
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _

# AA Blueprint Forge
from bpforge.api import schema
from bpforge.models.blueprint import Blueprint, Owner
from bpforge.models.general import General


class ApiEndpoints:
    tags = ["Shop"]

    # pylint: disable=too-many-statements
    def __init__(self, api: NinjaAPI):
        @api.get(
            "blueprints/",
            response={
                HTTPStatus.OK: list[schema.OwnerPublicSchema],
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="List all public blueprint owners",
        )
        def list_public_blueprints(request):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

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
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="Search all public blueprints",
        )
        def search_public_blueprints(request, q: str = ""):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            query = q.strip()
            if not query:
                return HTTPStatus.OK, []

            bpo_filter = Q(runs__isnull=True) | Q(runs=0)
            bpc_filter = Q(runs__gt=0)

            blueprint_qs = (
                Blueprint.objects.with_api_relations()
                .filter(owner__is_public=True)
                .filter(
                    Q(eve_type__name__icontains=query)
                    | Q(eve_type__group__name__icontains=query)
                )
                .filter(
                    (Q(owner__public_type="bpo") & bpo_filter)
                    | (Q(owner__public_type="bpc") & bpc_filter)
                    | (Q(owner__public_type="all") & (bpo_filter | bpc_filter))
                )
                .filter(
                    ~Q(
                        owner__selective_bpo_enabled=True,
                        runs__isnull=True,
                        is_offered=False,
                    ),
                    ~Q(
                        owner__selective_bpo_enabled=True,
                        runs=0,
                        is_offered=False,
                    ),
                )
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
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="List blueprints for a specific owner",
        )
        def list_owner_blueprints(request, owner_id: int):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            owner = get_object_or_404(
                Owner.objects.select_related("character__character", "corporation"),
                id=owner_id,
            )

            # Check visibility: public or owned by user or full_access admin
            is_owner = owner.user == request.user
            is_admin = General.has_administration_access(request.user)
            if not (owner.is_public or is_owner or is_admin):
                return HTTPStatus.FORBIDDEN, {
                    "error": _("This blueprint catalog is private.")
                }

            blueprint_qs = Blueprint.objects.with_catalog_relations().filter(
                owner=owner
            )

            # In the blueprint catalog, always filter by public_type & selective BPOs as configured by the owner
            if owner.public_type == "bpo":
                blueprint_qs = blueprint_qs.filter(Q(runs__isnull=True) | Q(runs=0))
            elif owner.public_type == "bpc":
                blueprint_qs = blueprint_qs.filter(runs__gt=0)

            if owner.selective_bpo_enabled:
                blueprint_qs = blueprint_qs.filter(Q(runs__gt=0) | Q(is_offered=True))

            blueprints = blueprint_qs.order_by("eve_type__name")

            result = [
                schema.BlueprintItemSchema.from_blueprint(bp, include_location=False)
                for bp in blueprints
            ]
            return HTTPStatus.OK, result
