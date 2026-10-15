"""Discord helper functions"""

# Third Party
from celery import shared_task

# Django
from django.apps import apps
from django.utils import timezone

# Alliance Auth
from allianceauth.authentication.models import User
from allianceauth.notifications import notify
from allianceauth.services.hooks import get_extension_logger

# AA Blueprint Forge
from bpforge import __title__
from bpforge.constants import DISCORD_EMBED_COLOR_MAP
from bpforge.models.general import UserSettings
from bpforge.providers import AppLogger

logger = AppLogger(get_extension_logger(__name__), __title__)


def allianceauth_discordbot_installed() -> bool:
    return apps.is_installed(app_name="aadiscordbot")


def discordnotify_installed() -> bool:
    return apps.is_installed(app_name="discordnotify")


# pylint: disable=import-outside-toplevel, unused-import
def discordproxy_installed() -> bool:
    try:
        # Third Party
        from discordproxy.client import DiscordClient
    except ModuleNotFoundError:
        return False
    return True


# pylint: disable=import-outside-toplevel, import-self, no-name-in-module
def _discordbot_send_direct_message(
    user_id: int,
    title: str,
    message: str,
    embed_message: bool = True,
    level: str = "info",
) -> None:
    """Send a private message to a user via discordbot"""

    # Third Party
    from aadiscordbot.tasks import send_message
    from discord import Embed

    embed = Embed(
        title=str(title),
        description=message,
        color=DISCORD_EMBED_COLOR_MAP.get(level),
        timestamp=timezone.now(),
    )

    if embed_message is True:
        send_message(user_id=user_id, embed=embed)
    else:
        send_message(user_id=user_id, message=f"**{title}**\n\n{message}")


def _discordproxy_send_direct_message(
    user_id: int,
    title: str,
    message: str,
    embed_message: bool = True,
    level: str = "info",
):
    """Send a direct message to a user via discordproxy"""
    # Third Party
    from discordproxy.client import DiscordClient

    client = DiscordClient()
    if embed_message is True:
        # Third Party
        from discordproxy.discord_api_pb2 import Embed

        footer = Embed.Footer(text=str(__title__))
        embed = Embed(
            title=str(title),
            description=message,
            color=DISCORD_EMBED_COLOR_MAP.get(level),
            timestamp=timezone.now().isoformat(),
            footer=footer,
        )

        client.create_direct_message(user_id=user_id, embed=embed)
    else:
        client.create_direct_message(
            user_id=user_id, content=f"**{title}**\n\n{message}"
        )


@shared_task
def send_user_notification(
    user_id: int | User,
    title: str,
    message: str,
    embed_message: bool = True,
    level: str = "info",
) -> None:
    """Send a notification as a Celery Task to a user via Discord or AllianceAuth notify."""
    if isinstance(user_id, User):
        user = user_id
    else:
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            logger.warning(
                "User with ID %s does not exist. Notification not sent.", user_id
            )
            return

    user_pk = getattr(user, "pk", user_id)
    if UserSettings.objects.filter(
        user_id=user_pk, disable_notifications=True
    ).exists():
        logger.info("Notifications are disabled for user %s; skipping delivery.", user)
        return

    getattr(notify, level)(user=user, title=title, message=message)

    if hasattr(user, "discord"):  # Check if the user has a Discord account
        if allianceauth_discordbot_installed():
            logger.debug(
                "Discord bot is installed, messages will be sent via Discord bot."
            )
            _discordbot_send_direct_message(
                user_id=int(user.discord.uid),
                title=title,
                message=message,
                embed_message=embed_message,
                level=level,
            )
            return
        if not discordnotify_installed():
            if discordproxy_installed():
                logger.debug(
                    "Discord proxy is installed, messages will be sent via Discord proxy."
                )
                _discordproxy_send_direct_message(
                    user_id=int(user.discord.uid),
                    title=title,
                    message=message,
                    embed_message=embed_message,
                    level=level,
                )
            return
        logger.debug("No message sender found, sending of Discord message canceled.")
    else:
        logger.debug(
            "User %s does not have a Discord account, sending of Discord message canceled.",
            user.username,
        )


def notify_order_created(order) -> None:
    """Notify the shop owner and configured groups that a new order has been created."""
    # pylint: disable=import-outside-toplevel
    # AA Blueprint Forge
    from bpforge.models.general import GeneralNotificationSettings

    owner = order.owner
    owner_name = (
        owner.corporation.corporation_name
        if owner.corporation
        else (
            owner.character.character.character_name
            if owner.character
            else owner.user.username
        )
    )

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
        send_user_notification(
            user_id=uid,
            title=title,
            message=message,
            level="info",
        )


def notify_order_status_updated(
    order, old_status: str, new_status: str, actor: User
) -> None:
    """Notify buyer, owner, and configured groups about an order status change."""
    # pylint: disable=import-outside-toplevel
    # AA Blueprint Forge
    from bpforge.models.general import GeneralNotificationSettings

    owner = order.owner
    owner_name = (
        owner.corporation.corporation_name
        if owner.corporation
        else (
            owner.character.character.character_name
            if owner.character
            else owner.user.username
        )
    )

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
        send_user_notification(
            user_id=uid,
            title=title,
            message=message,
            level=level,
        )
