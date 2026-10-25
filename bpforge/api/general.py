# Standard Library
from http import HTTPStatus

# Third Party
from ninja import NinjaAPI

# Django
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.translation import gettext as _

# AA Blueprint Forge
from bpforge import __title__
from bpforge.api import schema
from bpforge.helpers.eveonline import (
    get_character_portrait_url,
    get_corporation_logo_url,
)
from bpforge.models.blueprint import Owner
from bpforge.models.general import General, UserSettings
from bpforge.models.helpers.update_manager import UpdateSection
from bpforge.tasks import update_owner


# pylint: disable=too-many-locals, too-many-statements
def _build_owner_setting_schema(owner: Owner) -> schema.OwnerSettingSchema:
    if owner.corporation:
        name = owner.corporation.corporation_name
        is_corp = True
        char_id = owner.character.character.character_id if owner.character else None
        char_name = (
            owner.character.character.character_name if owner.character else None
        )
        corp_id = owner.corporation.corporation_id
        corp_name = owner.corporation.corporation_name
        corp_ticker = owner.corporation.corporation_ticker
        alliance_id = (
            owner.corporation.alliance.alliance_id
            if owner.corporation.alliance
            else None
        )
        portrait_url = (
            get_corporation_logo_url(corporation_id=corp_id, size=64)
            if corp_id
            else None
        )
    elif owner.character:
        name = owner.character.character.character_name
        is_corp = False
        char_id = owner.character.character.character_id
        char_name = owner.character.character.character_name
        corp_id = owner.character.character.corporation_id
        corp_name = owner.character.character.corporation_name
        corp_ticker = owner.character.character.corporation_ticker
        alliance_id = owner.character.character.alliance_id
        portrait_url = (
            get_character_portrait_url(character_id=char_id, size=64)
            if char_id
            else None
        )
    else:
        name = owner.user.username
        is_corp = False
        char_id = None
        char_name = None
        corp_id = None
        corp_name = None
        corp_ticker = None
        alliance_id = None
        portrait_url = None

    sections_dict = {s.section: s for s in owner.bpforge_update_status.all()}

    section_list: list[schema.OwnerStatusSectionSchema] = []
    last_finished_dt = None
    latest_error_message = None

    for sec in UpdateSection:
        status_obj = sections_dict.get(sec.value)
        if status_obj:
            if status_obj.last_run_finished_at and (
                last_finished_dt is None
                or status_obj.last_run_finished_at > last_finished_dt
            ):
                last_finished_dt = status_obj.last_run_finished_at

            if status_obj.error_message and not latest_error_message:
                latest_error_message = status_obj.error_message

            section_list.append(
                schema.OwnerStatusSectionSchema(
                    section=sec.value,
                    section_name=str(sec.label),
                    is_success=status_obj.is_success,
                    has_token_error=status_obj.has_token_error,
                    error_message=status_obj.error_message or None,
                    last_run_at=(
                        status_obj.last_run_at.strftime("%Y-%m-%d %H:%M")
                        if status_obj.last_run_at
                        else None
                    ),
                    last_run_finished_at=(
                        status_obj.last_run_finished_at.strftime("%Y-%m-%d %H:%M")
                        if status_obj.last_run_finished_at
                        else None
                    ),
                )
            )
        else:
            section_list.append(
                schema.OwnerStatusSectionSchema(
                    section=sec.value,
                    section_name=str(sec.label),
                    is_success=None,
                    has_token_error=False,
                    error_message=None,
                    last_run_at=None,
                    last_run_finished_at=None,
                )
            )

    has_token_err = any(s.has_token_error for s in section_list)
    has_err = any(s.is_success is False for s in section_list)
    if has_token_err:
        status_val = "token_error"
    elif has_err:
        status_val = "error"
    elif all(s.is_success is True for s in section_list):
        status_val = "ok"
    else:
        status_val = "incomplete"

    last_sync = (
        last_finished_dt.strftime("%Y-%m-%d %H:%M") if last_finished_dt else None
    )

    return schema.OwnerSettingSchema(
        id=owner.id,
        name=name,
        is_corporation=is_corp,
        character_id=char_id,
        character_name=char_name,
        corporation_id=corp_id,
        corporation_name=corp_name,
        corporation_ticker=corp_ticker,
        alliance_id=alliance_id,
        portrait_url=portrait_url,
        is_public=owner.is_public,
        public_type=getattr(owner, "public_type", "all"),
        selective_bpo_enabled=getattr(owner, "selective_bpo_enabled", False),
        notify_order_created_group_ids=(
            list(owner.notify_order_created_groups.values_list("id", flat=True))
            if hasattr(owner, "notify_order_created_groups")
            else []
        ),
        notify_order_status_group_ids=(
            list(owner.notify_order_status_groups.values_list("id", flat=True))
            if hasattr(owner, "notify_order_status_groups")
            else []
        ),
        blueprint_count=getattr(owner, "blueprint_count", 0),
        bpo_count=getattr(owner, "bpo_count", 0),
        bpc_count=getattr(owner, "bpc_count", 0),
        status=status_val,
        has_error=has_token_err or has_err,
        last_sync=last_sync,
        error_message=latest_error_message,
        sections=section_list,
    )


class ApiEndpoints:
    tags = ["General"]

    def __init__(self, api: NinjaAPI):
        @api.get(
            "menu/",
            response={
                HTTPStatus.OK: schema.MenuSchema,
            },
            tags=self.tags,
            summary="Get AA Blueprint Shop navigation menu",
        )
        def get_menu(request):
            has_errors = False
            if request.user.is_authenticated:
                user_owners = Owner.objects.filter(user=request.user)
                for o in user_owners:
                    if o.bpforge_update_status.filter(
                        Q(has_token_error=True) | Q(is_success=False)
                    ).exists():
                        has_errors = True
                        break

            left_menu: list[schema.MenuLink] = []
            left_menu.append(schema.MenuLink(name=_("Overview"), link="/overview/"))
            left_menu.append(
                schema.MenuLink(name=_("My Blueprints"), link="/my-blueprints/")
            )
            left_menu.append(schema.MenuLink(name=_("Orders"), link="/orders/"))
            left_menu.append(
                schema.MenuLink(
                    name=_("Settings"),
                    link="/settings/",
                    has_errors=has_errors,
                )
            )

            right_menu: list[schema.MenuLink] = []
            if General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                right_menu.append(
                    schema.MenuLink(
                        name=_("Add Character"),
                        link=reverse("bpforge:add_character"),
                        is_external=True,
                    )
                )
                right_menu.append(
                    schema.MenuLink(
                        name=_("Add Corporation"),
                        link=reverse("bpforge:add_corporation"),
                        is_external=True,
                    )
                )

            if General.has_administration_access(request.user):
                right_menu.append(
                    schema.MenuLink(
                        name=_("Administration"),
                        link="/administration/",
                    )
                )

            return schema.MenuSchema(
                left_links=left_menu,
                right_links=right_menu,
            )

        @api.get(
            "user/",
            response={
                HTTPStatus.OK: schema.UserData,
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
        )
        def get_user(request):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            try:
                character_id = request.user.profile.main_character.character_id
                character_name = request.user.profile.main_character.character_name
                corporation_id = request.user.profile.main_character.corporation_id
                corporation_name = request.user.profile.main_character.corporation_name
                alliance_id = request.user.profile.main_character.alliance_id
                alliance_name = request.user.profile.main_character.alliance_name
            except AttributeError:
                character_id = 0
                character_name = ""
                corporation_id = 0
                corporation_name = ""
                alliance_id = None
                alliance_name = None

            portrait_url = (
                get_character_portrait_url(
                    character_id=character_id,
                    character_name=character_name,
                    as_html=False,
                )
                if character_id
                else None
            )

            is_admin = bool(General.has_administration_access(request.user))
            can_manage = General.can_manage_orders(request.user)
            is_global_mgr = General.is_global_order_manager(request.user)

            return HTTPStatus.OK, schema.UserData(
                user_id=request.user.id,
                character_id=character_id,
                character_name=character_name,
                corporation_id=corporation_id,
                corporation_name=corporation_name,
                alliance_id=alliance_id,
                alliance_name=alliance_name,
                portrait=portrait_url,
                is_admin=is_admin,
                is_superuser=bool(request.user.is_superuser),
                can_manage_orders=can_manage,
                is_global_order_manager=is_global_mgr,
            )

        @api.get(
            "settings/",
            response={
                HTTPStatus.OK: schema.UserSettingsSchema,
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="Get current user's settings",
        )
        def get_user_settings(request):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            settings = UserSettings.objects.get_or_create(user=request.user)[0]
            return schema.UserSettingsSchema(
                disable_notifications=settings.disable_notifications
            )

        @api.put(
            "settings/",
            response={
                HTTPStatus.OK: schema.UserSettingsSchema,
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="Update current user's settings",
        )
        def update_user_settings(request, payload: schema.UserSettingsUpdateRequest):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            settings = UserSettings.objects.get_or_create(user=request.user)[0]
            settings.disable_notifications = payload.disable_notifications
            settings.save(update_fields=["disable_notifications"])
            return schema.UserSettingsSchema(
                disable_notifications=settings.disable_notifications
            )

        @api.get(
            "settings/owners/",
            response={
                HTTPStatus.OK: list[schema.OwnerSettingSchema],
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="List current user's blueprint owners",
        )
        def get_user_owners(request):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            owners = (
                Owner.objects.filter(user=request.user)
                .select_related(
                    "character__character",
                    "corporation__alliance",
                )
                .prefetch_related(
                    "bpforge_update_status",
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

            result = [_build_owner_setting_schema(owner) for owner in owners]
            return HTTPStatus.OK, result

        @api.get(
            "user/characters/status/",
            response={
                HTTPStatus.OK: list[schema.UserCharacterStatusSchema],
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="Get current user's character and corporation update statuses for settings overview",
        )
        def get_user_character_statuses(request):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            owners = (
                Owner.objects.filter(user=request.user)
                .select_related(
                    "character__character",
                    "corporation__alliance",
                )
                .prefetch_related(
                    "bpforge_update_status",
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

            result = [_build_owner_setting_schema(owner) for owner in owners]
            return HTTPStatus.OK, result

        @api.patch(
            "settings/owners/{int:owner_id}/",
            response={
                HTTPStatus.OK: schema.OwnerSettingSchema,
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="Update public status of an owner",
        )
        def update_owner_setting(
            request, owner_id: int, payload: schema.OwnerSettingUpdateRequest
        ):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            owner = get_object_or_404(
                Owner.objects.select_related(
                    "character__character",
                    "corporation__alliance",
                )
                .prefetch_related(
                    "bpforge_update_status",
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
                ),
                id=owner_id,
            )

            is_owner = owner.user == request.user
            is_admin = General.has_administration_access(request.user)
            if not (is_owner or is_admin):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            update_fields = []
            if payload.is_public is not None:
                owner.is_public = payload.is_public
                update_fields.append("is_public")
            if payload.public_type is not None:
                owner.public_type = payload.public_type
                update_fields.append("public_type")
            if payload.selective_bpo_enabled is not None:
                owner.selective_bpo_enabled = payload.selective_bpo_enabled
                update_fields.append("selective_bpo_enabled")

            if update_fields:
                owner.save(update_fields=update_fields)

            return HTTPStatus.OK, _build_owner_setting_schema(owner)

        @api.get(
            "settings/owners/{int:owner_id}/bpos/",
            response={
                HTTPStatus.OK: list[schema.OwnerBpoItemSchema],
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="List all BPOs for an owner with their selective offering status",
        )
        def list_owner_bpos(request, owner_id: int):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            owner = get_object_or_404(Owner, id=owner_id)
            is_owner = owner.user == request.user
            is_admin = General.has_administration_access(request.user)
            if not (is_owner or is_admin):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            bpos = (
                owner.bpforge_blueprints.filter(Q(runs__isnull=True) | Q(runs=0))
                .select_related("eve_type__group", "location")
                .order_by("eve_type__name")
            )

            result = []
            for bp in bpos:
                result.append(
                    schema.OwnerBpoItemSchema(
                        item_id=bp.item_id,
                        type_id=bp.eve_type_id,
                        type_name=bp.eve_type.name,
                        group_name=bp.eve_type.group.name if bp.eve_type.group else "",
                        material_efficiency=bp.material_efficency,
                        time_efficiency=bp.time_efficiency,
                        location_name=bp.location.name if bp.location else "",
                        is_offered=bp.is_offered,
                    )
                )

            return HTTPStatus.OK, result

        @api.post(
            "settings/owners/{int:owner_id}/bpos/",
            response={
                HTTPStatus.OK: dict,
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="Update offered BPOs for an owner",
        )
        def update_owner_bpos(
            request, owner_id: int, payload: schema.OwnerBpoSelectionUpdateRequest
        ):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            owner = get_object_or_404(Owner, id=owner_id)
            is_owner = owner.user == request.user
            is_admin = General.has_administration_access(request.user)
            if not (is_owner or is_admin):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            offered_set = set(payload.offered_item_ids)
            bpos = owner.bpforge_blueprints.filter(Q(runs__isnull=True) | Q(runs=0))

            to_enable_ids = [
                bp.item_id
                for bp in bpos
                if bp.item_id in offered_set and not bp.is_offered
            ]
            to_disable_ids = [
                bp.item_id
                for bp in bpos
                if bp.item_id not in offered_set and bp.is_offered
            ]

            if to_enable_ids:
                bpos.filter(item_id__in=to_enable_ids).update(is_offered=True)
            if to_disable_ids:
                bpos.filter(item_id__in=to_disable_ids).update(is_offered=False)

            return HTTPStatus.OK, {"success": True, "count": len(offered_set)}

        @api.post(
            "settings/owners/update-all/",
            response={
                HTTPStatus.OK: schema.TaskTriggerResponseSchema,
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="Trigger update tasks for all owners of the current user",
        )
        def trigger_update_all_user_owners(
            request,
            payload: schema.OwnerUpdateRequest | None = None,
        ):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            force_refresh = payload.force_refresh if payload else False
            owners = Owner.objects.filter(user=request.user)
            count = 0
            for owner in owners:
                update_owner.delay(owner_pk=owner.pk, force_refresh=force_refresh)
                count += 1

            return HTTPStatus.OK, schema.TaskTriggerResponseSchema(
                success=True,
                message=_("Queued updates for %(count)d owner(s).") % {"count": count},
            )

        @api.post(
            "settings/owners/{int:owner_id}/update/",
            response={
                HTTPStatus.OK: schema.TaskTriggerResponseSchema,
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="Trigger update task for a specific owner in settings",
        )
        def trigger_owner_update_settings(
            request,
            owner_id: int,
            payload: schema.OwnerUpdateRequest | None = None,
        ):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            owner = get_object_or_404(
                Owner.objects.select_related("character__character", "corporation"),
                id=owner_id,
            )
            is_owner = owner.user == request.user
            is_admin = General.has_administration_access(request.user)
            if not (is_owner or is_admin):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            force_refresh = payload.force_refresh if payload else False
            update_owner.delay(owner_pk=owner.pk, force_refresh=force_refresh)

            owner_name = owner.name

            return HTTPStatus.OK, schema.TaskTriggerResponseSchema(
                success=True,
                message=_(
                    f"Update task queued for {owner_name} (force_refresh={force_refresh})."
                ),
            )

        @api.delete(
            "settings/owners/{int:owner_id}/",
            response={
                HTTPStatus.OK: schema.TaskTriggerResponseSchema,
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="Delete owner and associated data from blueprint forge",
        )
        def delete_owner_settings(request, owner_id: int):
            if not General.has_perm(request.user, General.Permission.BASIC_ACCESS):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            owner = get_object_or_404(
                Owner.objects.select_related("character__character", "corporation"),
                id=owner_id,
            )
            is_owner = owner.user == request.user
            is_admin = General.has_administration_access(request.user)
            if not (is_owner or is_admin):
                return HTTPStatus.FORBIDDEN, {"error": _("Permission Denied.")}

            owner_name = owner.name
            owner.delete()

            return HTTPStatus.OK, schema.TaskTriggerResponseSchema(
                success=True,
                message=_("Owner %(name)s and associated data deleted.")
                % {"name": owner_name},
            )
