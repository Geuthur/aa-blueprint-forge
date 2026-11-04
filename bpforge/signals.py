"""Signals of Blueprint Forge."""

# pylint: disable=unused-argument

# Django
from django.contrib.auth import get_user_model
from django.db.models import QuerySet
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.utils import timezone

# Alliance Auth
from allianceauth.authentication.models import User

# AA Blueprint Forge
from bpforge.models.blueprint import Owner
from bpforge.models.helpers.core import RequestStatus
from bpforge.models.request import OPEN_ORDER_STATUSES, Order, Request
from bpforge.thirdparty.discord import notify_order_cancelled_by_shop_removal


def _cancel_orders(orders: QuerySet[Order]) -> None:
    """Close orders that nobody can process once their shop or buyer is gone."""
    now = timezone.now()
    order_ids = list(orders.values_list("pk", flat=True))
    Request.objects.filter(order__in=order_ids).update(
        status=RequestStatus.CANCELLED, closed_at=now
    )
    Order.objects.filter(pk__in=order_ids).update(
        status=RequestStatus.CANCELLED, closed_at=now, updated_at=now
    )


@receiver(pre_delete, sender=Owner)
def cancel_open_orders_of_owner(sender, instance: Owner, **kwargs):
    """Cancel the open orders of a deleted shop and tell the buyers."""
    open_orders = instance.orders.filter(status__in=OPEN_ORDER_STATUSES)
    # A shop owner who deletes the own shop does not need to be told about it
    orders_to_notify = list(
        open_orders.exclude(requesting_user=instance.user)
        .exclude(requesting_user__isnull=True)
        .select_related("requesting_user", "owner")
    )
    _cancel_orders(open_orders)
    for order in orders_to_notify:
        notify_order_cancelled_by_shop_removal(order)


# Alliance Auth has a proxy of the user model, signals are sent for the deleted class
@receiver(pre_delete, sender=User)
@receiver(pre_delete, sender=get_user_model())
def cancel_open_orders_of_buyer(sender, instance: User, **kwargs):
    """Cancel the open orders of a deleted buyer."""
    _cancel_orders(
        Order.objects.filter(requesting_user=instance, status__in=OPEN_ORDER_STATUSES)
    )
