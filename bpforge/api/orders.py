"""API endpoints for orders and request management."""

# Standard Library
from http import HTTPStatus

# Third Party
from ninja import NinjaAPI

# Django
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _

# AA Blueprint Forge
from bpforge.api import schema
from bpforge.models.blueprint import Blueprint, Owner
from bpforge.models.general import General
from bpforge.models.helpers.core import RequestStatus
from bpforge.models.request import OPEN_ORDER_STATUSES, Order, Request
from bpforge.thirdparty.discord import (
    notify_order_created,
    notify_order_status_updated,
)

# Blueprints in a container resolve their name through the office to the station
ORDER_ITEM_PREFETCH = (
    "items__blueprint__eve_type",
    "items__blueprint__location__parent__parent",
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
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
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
                and not General.has_administration_access(request.user)
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
                or General.has_administration_access(request.user)
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

            return HTTPStatus.CREATED, _serialize_order(
                order, _can_see_location(request.user, order)
            )

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
            """Role can be 'buyer', 'seller', 'manage', 'all' or 'history'.

            The first four list open orders, 'history' lists the closed ones.
            """
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            queryset = Order.objects.select_related(
                "owner__character__character",
                "owner__corporation",
                "owner__user",
                "requesting_user__profile__main_character",
            ).prefetch_related(*ORDER_ITEM_PREFETCH)

            manage_filter = General.get_manageable_orders_filter(request.user)

            own_orders = Q(requesting_user=request.user) | Q(seller_user=request.user)

            if role == "history":
                queryset = queryset.exclude(status__in=OPEN_ORDER_STATUSES)
                # An empty filter means a global manager, who sees every order
                if manage_filter is None:
                    queryset = queryset.filter(own_orders)
                elif manage_filter:
                    queryset = queryset.filter(own_orders | manage_filter)
            else:
                queryset = queryset.filter(status__in=OPEN_ORDER_STATUSES)
                if role == "buyer":
                    queryset = queryset.filter(requesting_user=request.user)
                elif role == "seller":
                    queryset = queryset.filter(seller_user=request.user)
                elif role == "manage":
                    if manage_filter is None:
                        return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}
                    queryset = queryset.filter(manage_filter)
                else:
                    queryset = queryset.filter(own_orders)

            orders = list(queryset.distinct().order_by("-created_at"))

            # Checked once per request instead of per order, the lists are polled
            manageable_ids = (
                set(
                    Order.objects.filter(
                        manage_filter, id__in=[order.id for order in orders]
                    ).values_list("id", flat=True)
                )
                if manage_filter is not None
                else set()
            )

            return HTTPStatus.OK, [
                _serialize_order(
                    order,
                    order.seller_user_id == request.user.id
                    or order.id in manageable_ids,
                )
                for order in orders
            ]

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
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            order = get_object_or_404(
                Order.objects.select_related(
                    "owner__character__character",
                    "owner__corporation",
                    "owner__user",
                    "requesting_user__profile__main_character",
                ).prefetch_related(*ORDER_ITEM_PREFETCH),
                id=order_id,
            )

            is_buyer = order.requesting_user == request.user
            is_seller = order.seller_user_id == request.user.id
            is_manager = General.can_manage_order(request.user, order)

            if not (is_buyer or is_seller or is_manager):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            return HTTPStatus.OK, _serialize_order(
                order, _can_see_location(request.user, order)
            )

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
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            order = get_object_or_404(
                Order.objects.select_related(
                    "owner__character__character",
                    "owner__corporation",
                    "owner__user",
                    "requesting_user__profile__main_character",
                ).prefetch_related(*ORDER_ITEM_PREFETCH),
                id=order_id,
            )

            valid_statuses = [choice[0] for choice in RequestStatus.choices]
            if payload.status not in valid_statuses:
                return HTTPStatus.BAD_REQUEST, {
                    "error": _(f"Invalid status. Must be one of: {valid_statuses}")
                }

            if order.owner is None or order.requesting_user is None:
                return HTTPStatus.BAD_REQUEST, {
                    "error": _(
                        "This order is closed because its shop or buyer was deleted."
                    )
                }

            can_edit = General.can_manage_order(request.user, order)

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

            return HTTPStatus.OK, _serialize_order(
                order, _can_see_location(request.user, order)
            )

        @api.delete(
            "orders/{int:order_id}/",
            response={
                HTTPStatus.OK: schema.TaskTriggerResponseSchema,
                HTTPStatus.BAD_REQUEST: dict,
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="Delete a closed order completely (Superusers only)",
        )
        def delete_order(request, order_id: int):
            if not request.user.is_superuser:
                return HTTPStatus.FORBIDDEN, {
                    "error": _("You are not authorized to delete this order.")
                }

            order = get_object_or_404(Order, id=order_id)

            if order.status in OPEN_ORDER_STATUSES:
                return HTTPStatus.BAD_REQUEST, {
                    "error": _("Only closed orders can be deleted.")
                }

            order.delete()
            return HTTPStatus.OK, schema.TaskTriggerResponseSchema(
                success=True,
                message=_("Order has been deleted successfully."),
            )


def _can_see_location(user, order: Order) -> bool:
    """Only the seller and order managers see where the blueprints of an order are."""
    return order.seller_user_id == user.id or General.can_manage_order(user, order)


def _get_item_values(item: Request) -> dict:
    """Return the current blueprint values, or the copy once the blueprint is gone."""
    bp = item.blueprint
    if bp is None:
        return {
            "blueprint_id": item.item_id,
            "type_id": item.type_id,
            "type_name": item.type_name,
            "material_efficiency": item.material_efficiency,
            "time_efficiency": item.time_efficiency,
            "location_name": item.location_name,
        }
    return {
        "blueprint_id": bp.item_id,
        "type_id": bp.eve_type_id,
        "type_name": bp.eve_type.name,
        "material_efficiency": bp.material_efficency,
        "time_efficiency": bp.time_efficiency,
        "location_name": schema.BlueprintItemSchema.get_location_name(bp),
    }


def _serialize_order(order: Order, include_location: bool) -> schema.OrderSchema:
    items_schema: list[schema.OrderItemSchema] = []
    for item in order.items.all():
        values = _get_item_values(item)
        location_name = values.pop("location_name")
        items_schema.append(
            schema.OrderItemSchema(
                id=item.id,
                quantity=item.quantity,
                runs=item.runs,
                location_name=location_name if include_location else None,
                blueprint_available=item.blueprint is not None,
                status=item.status,
                **values,
            )
        )

    return schema.OrderSchema(
        id=order.id,
        owner_id=order.owner_id,
        owner_name=order.display_owner_name,
        requesting_user_id=order.requesting_user_id,
        requesting_user_name=order.display_buyer_name,
        status=order.status,
        note=order.note,
        items=items_schema,
        created_at=order.created_at.isoformat(),
        updated_at=order.updated_at.isoformat(),
        closed_at=order.closed_at.isoformat() if order.closed_at else None,
    )
