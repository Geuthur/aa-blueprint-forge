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
            if not request.user.has_perm("bpforge.basic_access"):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            # Query public owners with blueprint counts
            # pylint: disable=duplicate-code
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
                        filter=Q(bpforge_blueprints__runs__isnull=True)
                        | Q(bpforge_blueprints__runs=0),
                        distinct=True,
                    ),
                    bpc_count=Count(
                        "bpforge_blueprints",
                        filter=Q(bpforge_blueprints__runs__gt=0),
                        distinct=True,
                    ),
                )
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
                        effective_bpo = owner.bpforge_blueprints.filter(
                            Q(runs__isnull=True) | Q(runs=0), is_offered=True
                        ).count()
                    else:
                        effective_bpo = owner.bpo_count
                else:
                    effective_bpc = owner.bpc_count
                    if owner.selective_bpo_enabled:
                        effective_bpo = owner.bpforge_blueprints.filter(
                            Q(runs__isnull=True) | Q(runs=0), is_offered=True
                        ).count()
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
            if not request.user.has_perm("bpforge.basic_access"):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            query = q.strip()
            if not query:
                return HTTPStatus.OK, []

            bpo_filter = Q(runs__isnull=True) | Q(runs=0)
            bpc_filter = Q(runs__gt=0)

            blueprint_qs = (
                Blueprint.objects.filter(owner__is_public=True)
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
                .select_related(
                    "eve_type__group",
                    "location",
                    "owner__character__character",
                    "owner__corporation",
                )
                .order_by("eve_type__name")[:250]
            )

            result: list[schema.BlueprintItemSchema] = []
            for bp in blueprint_qs:
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
            if not request.user.has_perm("bpforge.basic_access"):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            owner = get_object_or_404(
                Owner.objects.select_related("character__character", "corporation"),
                id=owner_id,
            )

            # Check visibility: public or owned by user or full_access admin
            is_owner = owner.user == request.user
            is_admin = request.user.has_perm("bpforge.full_access")
            if not (owner.is_public or is_owner or is_admin):
                return HTTPStatus.FORBIDDEN, {
                    "error": _("This blueprint catalog is private.")
                }

            blueprint_qs = Blueprint.objects.filter(owner=owner)

            # In the blueprint catalog, always filter by public_type & selective BPOs as configured by the owner
            if owner.public_type == "bpo":
                blueprint_qs = blueprint_qs.filter(Q(runs__isnull=True) | Q(runs=0))
            elif owner.public_type == "bpc":
                blueprint_qs = blueprint_qs.filter(runs__gt=0)

            if owner.selective_bpo_enabled:
                blueprint_qs = blueprint_qs.filter(Q(runs__gt=0) | Q(is_offered=True))

            blueprints = blueprint_qs.select_related(
                "eve_type__group",
                "location",
                "owner__character__character",
                "owner__corporation",
            ).order_by("eve_type__name")

            # pylint: disable=duplicate-code
            owner_name = (
                owner.corporation.corporation_name
                if owner.corporation
                else (
                    owner.character.character.character_name
                    if owner.character
                    else owner.user.username
                )
            )

            # pylint: disable=duplicate-code
            result: list[schema.BlueprintItemSchema] = []
            for bp in blueprints:
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
