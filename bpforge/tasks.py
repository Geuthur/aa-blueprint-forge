"""App Tasks"""

# Third Party
from celery import shared_task

# Alliance Auth
from allianceauth.services.hooks import get_extension_logger
from allianceauth.services.tasks import QueueOnce
from esi.decorators import rate_limit_retry_task
from esi.models import Token

# AA Blueprint Forge
from bpforge import __title__, app_settings
from bpforge.models.blueprint import Location, Owner
from bpforge.models.helpers.update_manager import UpdateSection
from bpforge.providers import AppLogger

logger = AppLogger(get_extension_logger(__name__), __title__)

MAX_RETRIES_DEFAULT = 3

# Default params for all tasks.
TASK_DEFAULTS = {
    "time_limit": app_settings.BPFORGE_TASKS_TIME_LIMIT,
    "max_retries": MAX_RETRIES_DEFAULT,
}

# Default params for tasks that need bind=True.
TASK_DEFAULTS_BIND = {**TASK_DEFAULTS, **{"bind": True}}
# Default params for tasks that need bind=True and run once only.
TASK_DEFAULTS_BIND_ONCE = {**TASK_DEFAULTS, **{"bind": True, "base": QueueOnce}}
# Default params for tasks that need run once only.
TASK_DEFAULTS_ONCE = {**TASK_DEFAULTS, **{"base": QueueOnce}}

TASK_DEFAULTS_ONCE_OWNER = {
    **TASK_DEFAULTS,
    **{"once": {"keys": ["owner_pk"], "graceful": True}},
}


@shared_task(**TASK_DEFAULTS_ONCE)
def update_all_blueprints(force_refresh=False, target="all"):
    """Fetch all blueprints for all owners or filtered by target from ESI."""
    qs = Owner.objects.all()
    if target == "characters":
        qs = qs.filter(character__isnull=False)
    elif target == "corporations":
        qs = qs.filter(corporation__isnull=False)

    queued_pks = set()
    for owner in qs:
        result = update_owner.apply_async(
            kwargs={
                "owner_pk": owner.pk,
                "force_refresh": force_refresh,
            },
        )
        queued_pks.add(result.id)
    logger.info("Queued %s Owner Updates (target=%s)", len(queued_pks), target)


@shared_task(**TASK_DEFAULTS_ONCE_OWNER)
def update_owner(owner_pk: int, force_refresh: bool = False) -> bool:
    """
    Update a owner by running necessary section updates directly.

    Args:
        owner_pk (int): Primary key of the owner to update.
        force_refresh (bool): If True, forces a refresh of all sections.

    Returns:
        bool: True if updates were executed, False otherwise.
    """
    try:
        owner = Owner.objects.prefetch_related("bpforge_update_status").get(pk=owner_pk)
    except Owner.DoesNotExist:
        logger.warning("Owner with pk %s not found.", owner_pk)
        return False

    logger.debug("Processing Owner Updates for %s", format(owner))

    sections = owner.get_sections_to_update(force_refresh=force_refresh)

    if not sections:
        logger.info("No updates needed for %s", owner)
    else:
        runs = 0

        for section in sections:
            task_name = f"update_{section}"
            task = globals().get(task_name)
            if task:
                task(owner_pk=owner.pk, force_refresh=force_refresh)
            else:
                _update_owner_section(
                    owner_pk=owner.pk,
                    section=section,
                    force_refresh=force_refresh,
                )
            runs += 1

        logger.debug(
            "Executed %s Owner Updates for %s",
            runs,
            owner,
        )
    return True


def _update_owner_section(owner_pk: int, section: str, force_refresh: bool):
    """Update a specific section of the owner."""
    section = UpdateSection(section)
    try:
        owner = Owner.objects.get(pk=owner_pk)
    except Owner.DoesNotExist:
        logger.warning("Owner with pk %s not found.", owner_pk)
        return None

    logger.debug("Updating %s for %s", section.label, owner)

    result = owner.execute_section(section, force_refresh=force_refresh)
    return result


@shared_task(**TASK_DEFAULTS_ONCE_OWNER)
@rate_limit_retry_task
def update_blueprints(owner_pk: int, force_refresh: bool):
    return _update_owner_section(
        owner_pk=owner_pk,
        section=UpdateSection.BLUEPRINTS,
        force_refresh=force_refresh,
    )


@shared_task(**TASK_DEFAULTS_ONCE_OWNER)
@rate_limit_retry_task
def update_locations(owner_pk: int, force_refresh: bool):
    return _update_owner_section(
        owner_pk=owner_pk,
        section=UpdateSection.LOCATIONS,
        force_refresh=force_refresh,
    )


@shared_task(
    max_retries=None,
    base=QueueOnce,
    once={"keys": ["structure_id"], "graceful": True},
    time_limit=app_settings.BPFORGE_TASKS_TIME_LIMIT,
)
@rate_limit_retry_task
def update_structure_esi(structure_id: int, token_pk: int):
    """Update a structure object from ESI."""
    token = Token.objects.get(pk=token_pk)
    Location.objects.structure_update_or_create_esi(
        structure_id=structure_id, token=token
    )
