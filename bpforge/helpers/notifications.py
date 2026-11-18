"""Notifications about orders."""

# Django
from django.conf import settings

# Alliance Auth
from allianceauth.authentication.models import User

# AA Blueprint Forge
from bpforge.models.general import General, GeneralNotificationSettings
from bpforge.thirdparty.discord import send_user_notification


def _build_order_notification_message(order, base_message: str, recipient: User) -> str:
    """Append a tailored link to the orders page for the recipient."""
    site_url = getattr(settings, "SITE_URL", "").rstrip("/")
    base_orders_url = f"{site_url}/bpforge/orders/" if site_url else "/bpforge/orders/"

    if General.can_manage_orders(recipient):
        order_url = f"{base_orders_url}?tab=manage"
        action_label = "Open Order Management"
    elif recipient.pk == order.requesting_user_id:
        order_url = f"{base_orders_url}?tab=buyer"
        action_label = "View Order"
    else:
        order_url = f"{base_orders_url}?tab=seller"
        action_label = "View Catalog Orders"

    return f"{base_message}\n\n🔗 [{action_label}]({order_url})"


def notify_order_created(order) -> None:
    """Notify the shop owner and configured groups that a new order has been created."""
    owner = order.owner
    owner_name = owner.name

    try:
        buyer_name = order.requesting_user.profile.main_character.character_name
    except AttributeError:
        buyer_name = order.requesting_user.username

    title = f"New Blueprint Order #{order.pk} - {owner_name}"
    item_count = order.items.count()
    message = (
        f"A new order **#{order.pk}** has been placed by **{buyer_name}** "
        f"for shop **{owner_name}** with **{item_count}** item(s)."
    )
    if order.note:
        message += f"\n\n**Note:** {order.note}"

    recipients: set[int] = set()
    if owner.user_id:
        recipients.add(owner.user_id)

    # Owner-specific notification groups
    for group in owner.notify_order_created_groups.all():
        for user in group.user_set.filter(is_active=True):
            recipients.add(user.pk)

    # Global notification groups
    global_settings = GeneralNotificationSettings.get_solo()
    for group in global_settings.order_created_groups.all():
        for user in group.user_set.filter(is_active=True):
            recipients.add(user.pk)

    for uid in recipients:
        try:
            recipient_user = User.objects.get(pk=uid)
        except User.DoesNotExist:
            continue

        personalized_message = _build_order_notification_message(
            order=order,
            base_message=message,
            recipient=recipient_user,
        )
        send_user_notification(
            user_id=uid,
            title=title,
            message=personalized_message,
            level="info",
        )


# pylint: disable=too-many-locals
def notify_order_cancelled_by_shop_removal(order) -> None:
    """Notify the buyer that an open order was cancelled because its shop was deleted."""
    message = (
        f"Order **#{order.pk}** for **{order.display_owner_name}** was cancelled "
        "because the shop was removed."
    )
    send_user_notification(
        user_id=order.requesting_user_id,
        title=f"Blueprint Order #{order.pk} Status: Cancelled",
        message=_build_order_notification_message(
            order=order,
            base_message=message,
            recipient=order.requesting_user,
        ),
        level="danger",
    )


def notify_order_status_updated(
    order, old_status: str, new_status: str, actor: User
) -> None:
    """Notify buyer, owner, and configured groups about an order status change."""
    owner = order.owner
    owner_name = owner.name

    try:
        actor_name = actor.profile.main_character.character_name
    except AttributeError:
        actor_name = actor.username

    title = f"Blueprint Order #{order.pk} Status: {new_status}"
    message = (
        f"Order **#{order.pk}** for **{owner_name}** status was changed "
        f"from **{old_status}** to **{new_status}** by **{actor_name}**."
    )

    if new_status in ["Delivered", "Accepted"]:
        level = "success"
    elif new_status in ["Declined", "Cancelled"]:
        level = "danger"
    else:
        level = "info"

    recipients: set[int] = set()
    # Always notify the buyer
    if order.requesting_user_id:
        recipients.add(order.requesting_user_id)

    # Notify the shop owner if the status change wasn't made by the owner
    if owner.user_id and actor != owner.user:
        recipients.add(owner.user_id)

    # Owner-specific status notification groups
    for group in owner.notify_order_status_groups.all():
        for user in group.user_set.filter(is_active=True):
            recipients.add(user.pk)

    # Global status notification groups
    global_settings = GeneralNotificationSettings.get_solo()
    for group in global_settings.order_status_groups.all():
        for user in group.user_set.filter(is_active=True):
            recipients.add(user.pk)

    for uid in recipients:
        try:
            recipient_user = User.objects.get(pk=uid)
        except User.DoesNotExist:
            continue

        personalized_message = _build_order_notification_message(
            order=order,
            base_message=message,
            recipient=recipient_user,
        )
        send_user_notification(
            user_id=uid,
            title=title,
            message=personalized_message,
            level=level,
        )
