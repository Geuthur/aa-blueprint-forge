"""API endpoints for orders and request management."""

# Standard Library
from http import HTTPStatus

# Third Party
from ninja import NinjaAPI

# Django
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _

# AA Blueprint Forge
from bpforge.api import schema
from bpforge.models.blueprint import Blueprint, Owner
from bpforge.models.general import (
    get_manageable_orders_filter,
    user_can_manage_order,
    user_can_manage_orders,
)
from bpforge.models.helpers.core import RequestStatus
from bpforge.models.request import Order, Request
from bpforge.thirdparty.discord import (
    notify_order_created,
    notify_order_status_updated,
)


class ApiEndpoints:
    tags = ["Orders"]

    # pylint: disable=too-many-statements
    def __init__(self, api: NinjaAPI):
        @api.post(
            "orders/",
            response={
                HTTPStatus.CREATED: schema.OrderSchema,
                HTTPStatus.BAD_REQUEST: dict,
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="Create a new batch order with multiple blueprints",
        )
        # pylint: disable=too-many-return-statements
        def create_order(request, payload: schema.OrderCreateRequest):
            if not request.user.has_perm("bpforge.basic_access"):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            if not payload.items:
                return HTTPStatus.BAD_REQUEST, {
                    "error": _("Order must contain at least one blueprint item.")
                }

            owner = get_object_or_404(Owner, id=payload.owner_id)

            # Prevent ordering from a private shop unless owned by requester or admin
            if (
                not owner.is_public
                and owner.user != request.user
                and not request.user.has_perm("bpforge.full_access")
            ):
                return HTTPStatus.FORBIDDEN, {
                    "error": _("Cannot order from a private shop.")
                }

            blueprint_ids = [item.blueprint_id for item in payload.items]
            blueprints = Blueprint.objects.filter(
                owner=owner, item_id__in=blueprint_ids
            ).select_related("eve_type")

            bp_map = {bp.item_id: bp for bp in blueprints}
            if len(bp_map) != len(set(blueprint_ids)):
                return HTTPStatus.BAD_REQUEST, {
                    "error": _(
                        "One or more blueprints are invalid or do not belong to this shop."
                    )
                }

            if not (
                owner.user == request.user
                or request.user.has_perm("bpforge.full_access")
            ):
                if owner.public_type == "bpo" and any(
                    bp.runs and bp.runs > 0 for bp in blueprints
                ):
                    return HTTPStatus.BAD_REQUEST, {
                        "error": _("This shop only offers blueprint originals (BPO).")
                    }
                if owner.public_type == "bpc" and any(
                    not bp.runs or bp.runs == 0 for bp in blueprints
                ):
                    return HTTPStatus.BAD_REQUEST, {
                        "error": _("This shop only offers blueprint copies (BPC).")
                    }
                if owner.selective_bpo_enabled and any(
                    (not bp.runs or bp.runs == 0) and not bp.is_offered
                    for bp in blueprints
                ):
                    return HTTPStatus.BAD_REQUEST, {
                        "error": _(
                            "One or more selected BPOs are not offered by this shop."
                        )
                    }

            with transaction.atomic():
                order = Order.objects.create(
                    owner=owner,
                    requesting_user=request.user,
                    status=RequestStatus.PENDING,
                    note=payload.note,
                )

                order_items: list[Request] = []
                for item_in in payload.items:
                    bp = bp_map[item_in.blueprint_id]
                    req = Request.objects.create(
                        order=order,
                        blueprint=bp,
                        requesting_user=request.user,
                        quantity=item_in.quantity,
                        runs=item_in.runs or bp.runs,
                        status=RequestStatus.PENDING,
                    )
                    order_items.append(req)

            notify_order_created(order)

            return HTTPStatus.CREATED, _serialize_order(order)

        @api.get(
            "orders/",
            response={
                HTTPStatus.OK: list[schema.OrderSchema],
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="List orders (either placed as buyer or received as seller)",
        )
        def list_orders(request, role: str = "all"):
            """Role can be 'buyer', 'seller', 'manage', or 'all'."""
            if not request.user.has_perm("bpforge.basic_access"):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            queryset = Order.objects.select_related(
                "owner__character__character",
                "owner__corporation",
                "owner__user",
                "requesting_user__profile__main_character",
            ).prefetch_related(
                "items__blueprint__eve_type",
            )

            if role == "buyer":
                queryset = queryset.filter(requesting_user=request.user)
            elif role == "seller":
                queryset = queryset.filter(owner__user=request.user)
            elif role == "manage":
                if not user_can_manage_orders(request.user):
                    return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}
                manage_filter = get_manageable_orders_filter(request.user)
                if manage_filter is None:
                    return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}
                queryset = queryset.filter(manage_filter)
            else:
                queryset = queryset.filter(
                    requesting_user=request.user
                ) | queryset.filter(owner__user=request.user)

            orders = queryset.distinct().order_by("-created_at")
            return HTTPStatus.OK, [_serialize_order(order) for order in orders]

        @api.get(
            "orders/{int:order_id}/",
            response={
                HTTPStatus.OK: schema.OrderSchema,
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="Get specific order details",
        )
        def get_order(request, order_id: int):
            if not request.user.has_perm("bpforge.basic_access"):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            order = get_object_or_404(
                Order.objects.select_related(
                    "owner__character__character",
                    "owner__corporation",
                    "owner__user",
                    "requesting_user__profile__main_character",
                ).prefetch_related("items__blueprint__eve_type"),
                id=order_id,
            )

            is_buyer = order.requesting_user == request.user
            is_seller = order.owner.user == request.user
            is_manager = user_can_manage_order(request.user, order)

            if not (is_buyer or is_seller or is_manager):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            return HTTPStatus.OK, _serialize_order(order)

        @api.post(
            "orders/{int:order_id}/status/",
            response={
                HTTPStatus.OK: schema.OrderSchema,
                HTTPStatus.BAD_REQUEST: dict,
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="Update order status (Accept, Deliver, Decline, Cancel)",
        )
        def update_order_status(
            request, order_id: int, payload: schema.OrderStatusUpdateRequest
        ):
            if not request.user.has_perm("bpforge.basic_access"):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            order = get_object_or_404(
                Order.objects.select_related(
                    "owner__character__character",
                    "owner__corporation",
                    "owner__user",
                    "requesting_user__profile__main_character",
                ).prefetch_related("items__blueprint__eve_type"),
                id=order_id,
            )

            valid_statuses = [choice[0] for choice in RequestStatus.choices]
            if payload.status not in valid_statuses:
                return HTTPStatus.BAD_REQUEST, {
                    "error": _(f"Invalid status. Must be one of: {valid_statuses}")
                }

            can_edit = user_can_manage_order(request.user, order)

            old_status = order.status
            success = order.handle_status(
                user=request.user,
                status=payload.status,
                can_edit=can_edit,
            )

            if not success:
                return HTTPStatus.FORBIDDEN, {
                    "error": _("You are not authorized to set this order status.")
                }

            if old_status != payload.status:
                notify_order_status_updated(
                    order=order,
                    old_status=old_status,
                    new_status=payload.status,
                    actor=request.user,
                )

            return HTTPStatus.OK, _serialize_order(order)

        @api.delete(
            "orders/{int:order_id}/",
            response={
                HTTPStatus.OK: schema.TaskTriggerResponseSchema,
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="Delete an order completely (Managers only)",
        )
        def delete_order(request, order_id: int):
            if not request.user.has_perm("bpforge.basic_access"):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            order = get_object_or_404(
                Order.objects.select_related(
                    "owner__character__character",
                    "owner__corporation",
                    "owner__user",
                    "requesting_user__profile__main_character",
                ),
                id=order_id,
            )

            if not user_can_manage_order(request.user, order):
                return HTTPStatus.FORBIDDEN, {
                    "error": _("You are not authorized to delete this order.")
                }

            order.delete()
            return HTTPStatus.OK, schema.TaskTriggerResponseSchema(
                success=True,
                message=_("Order has been deleted successfully."),
            )


def _serialize_order(order: Order) -> schema.OrderSchema:
    owner = order.owner
    owner_name = owner.name

    try:
        buyer_name = order.requesting_user.profile.main_character.character_name
    except AttributeError:
        buyer_name = order.requesting_user.username

    items_schema: list[schema.OrderItemSchema] = []
    for item in order.items.all():
        bp = item.blueprint
        items_schema.append(
            schema.OrderItemSchema(
                id=item.id,
                blueprint_id=bp.item_id,
                type_id=bp.eve_type_id,
                type_name=bp.eve_type.name,
                quantity=item.quantity,
                runs=item.runs,
                material_efficiency=bp.material_efficency,
                time_efficiency=bp.time_efficiency,
                status=item.status,
            )
        )

    return schema.OrderSchema(
        id=order.id,
        owner_id=owner.id,
        owner_name=owner_name,
        requesting_user_id=order.requesting_user_id,
        requesting_user_name=buyer_name,
        status=order.status,
        note=order.note,
        items=items_schema,
        created_at=order.created_at.isoformat(),
        updated_at=order.updated_at.isoformat(),
        closed_at=order.closed_at.isoformat() if order.closed_at else None,
    )
