"""API endpoints for administration and global notification settings."""

# Standard Library
from http import HTTPStatus

# Third Party
from ninja import NinjaAPI

# Django
from django.contrib.auth.models import Group
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _

# AA Blueprint Forge
from bpforge.api import schema
from bpforge.api.general import _build_owner_setting_schema
from bpforge.models.blueprint import Blueprint, Owner
from bpforge.models.general import General, GeneralNotificationSettings
from bpforge.tasks import update_all_blueprints, update_owner


class ApiEndpoints:
    tags = ["Administration"]

    # pylint: disable=too-many-statements
    def __init__(self, api: NinjaAPI):
        @api.get(
            "administration/groups/",
            response={
                HTTPStatus.OK: list[schema.GroupSchema],
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="List all Alliance Auth groups for notification configuration",
        )
        def list_groups(request):
            if not General.has_perm(request.user, General.Permission.FULL_ACCESS):
                return HTTPStatus.FORBIDDEN, {
                    "error": _("Administration permission required.")
                }

            groups = Group.objects.all().order_by("name")
            return HTTPStatus.OK, [
                schema.GroupSchema(id=g.pk, name=g.name) for g in groups
            ]

        @api.get(
            "administration/settings/",
            response={
                HTTPStatus.OK: schema.AdministrationNotificationSettingsSchema,
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="Get global notification settings for administrators",
        )
        def get_notification_settings(request):
            if not General.has_perm(request.user, General.Permission.FULL_ACCESS):
                return HTTPStatus.FORBIDDEN, {
                    "error": _("Administration permission required.")
                }

            settings_obj = GeneralNotificationSettings.get_solo()
            return HTTPStatus.OK, schema.AdministrationNotificationSettingsSchema(
                order_created_group_ids=list(
                    settings_obj.order_created_groups.values_list("id", flat=True)
                ),
                order_status_group_ids=list(
                    settings_obj.order_status_groups.values_list("id", flat=True)
                ),
            )

        @api.put(
            "administration/settings/",
            response={
                HTTPStatus.OK: schema.AdministrationNotificationSettingsSchema,
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="Update global notification settings for administrators",
        )
        def update_notification_settings(
            request, payload: schema.AdministrationNotificationSettingsSchema
        ):
            if not General.has_perm(request.user, General.Permission.FULL_ACCESS):
                return HTTPStatus.FORBIDDEN, {
                    "error": _("Administration permission required.")
                }

            settings_obj = GeneralNotificationSettings.get_solo()
            settings_obj.order_created_groups.set(payload.order_created_group_ids)
            settings_obj.order_status_groups.set(payload.order_status_group_ids)

            return HTTPStatus.OK, schema.AdministrationNotificationSettingsSchema(
                order_created_group_ids=list(
                    settings_obj.order_created_groups.values_list("id", flat=True)
                ),
                order_status_group_ids=list(
                    settings_obj.order_status_groups.values_list("id", flat=True)
                ),
            )

        @api.get(
            "administration/owners/",
            response={
                HTTPStatus.OK: list[schema.OwnerSettingSchema],
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="List all owners across the entire system for administration management",
        )
        def list_all_owners(request):
            if not General.has_perm(request.user, General.Permission.FULL_ACCESS):
                return HTTPStatus.FORBIDDEN, {
                    "error": _("Administration permission required.")
                }

            owners = (
                Owner.objects.all()
                .select_related(
                    "user",
                    "character__character",
                    "corporation__alliance",
                )
                .prefetch_related(
                    "bpforge_update_status",
                    "notify_order_created_groups",
                    "notify_order_status_groups",
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
                .order_by("id")
            )

            result = [_build_owner_setting_schema(owner) for owner in owners]
            return HTTPStatus.OK, result

        @api.patch(
            "administration/owners/{int:owner_id}/",
            response={
                HTTPStatus.OK: schema.OwnerSettingSchema,
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="Administration update of an owner's settings and notification groups",
        )
        def update_owner_by_administration(
            request, owner_id: int, payload: schema.AdministrationOwnerUpdateRequest
        ):
            if not General.has_perm(request.user, General.Permission.FULL_ACCESS):
                return HTTPStatus.FORBIDDEN, {
                    "error": _("Administration permission required.")
                }

            owner = get_object_or_404(
                Owner.objects.select_related(
                    "character__character",
                    "corporation__alliance",
                )
                .prefetch_related(
                    "bpforge_update_status",
                    "notify_order_created_groups",
                    "notify_order_status_groups",
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

            if payload.notify_order_created_group_ids is not None:
                owner.notify_order_created_groups.set(
                    payload.notify_order_created_group_ids
                )
            if payload.notify_order_status_group_ids is not None:
                owner.notify_order_status_groups.set(
                    payload.notify_order_status_group_ids
                )

            return HTTPStatus.OK, _build_owner_setting_schema(owner)

        @api.get(
            "administration/owners/{int:owner_id}/blueprints/",
            response={
                HTTPStatus.OK: list[schema.BlueprintItemSchema],
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="List all blueprints for a specific owner for administration inspection",
        )
        def list_owner_blueprints_for_administration(request, owner_id: int):
            if not General.has_perm(request.user, General.Permission.FULL_ACCESS):
                return HTTPStatus.FORBIDDEN, {
                    "error": _("Administration permission required.")
                }

            owner = get_object_or_404(
                Owner.objects.select_related("character__character", "corporation"),
                id=owner_id,
            )

            blueprints = (
                Blueprint.objects.with_api_relations()
                .filter(owner=owner)
                .order_by("eve_type__name")
            )

            result = [
                schema.BlueprintItemSchema.from_blueprint(bp) for bp in blueprints
            ]
            return HTTPStatus.OK, result

        @api.post(
            "administration/owners/{int:owner_id}/update/",
            response={
                HTTPStatus.OK: schema.TaskTriggerResponseSchema,
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="Trigger update_owner Celery task for a specific owner",
        )
        def trigger_owner_update(
            request,
            owner_id: int,
            payload: schema.AdministrationUpdateOwnerTaskRequest | None = None,
        ):
            if not General.has_perm(request.user, General.Permission.FULL_ACCESS):
                return HTTPStatus.FORBIDDEN, {
                    "error": _("Administration permission required.")
                }

            owner = get_object_or_404(
                Owner.objects.select_related("character__character", "corporation"),
                id=owner_id,
            )
            force_refresh = payload.force_refresh if payload else False
            if force_refresh and not request.user.is_superuser:
                return HTTPStatus.FORBIDDEN, {
                    "error": _("Superuser permission required.")
                }
            update_owner.delay(owner_pk=owner.pk, force_refresh=force_refresh)

            owner_name = owner.name

            return HTTPStatus.OK, schema.TaskTriggerResponseSchema(
                success=True,
                message=_(
                    f"Update task queued for {owner_name} (force_refresh={force_refresh})."
                ),
            )

        @api.delete(
            "administration/owners/{int:owner_id}/",
            response={
                HTTPStatus.OK: schema.TaskTriggerResponseSchema,
                HTTPStatus.FORBIDDEN: dict,
                HTTPStatus.NOT_FOUND: dict,
            },
            tags=self.tags,
            summary="Delete an owner and all associated blueprints and configurations",
        )
        def delete_owner_by_administration(request, owner_id: int):
            if not General.has_perm(request.user, General.Permission.FULL_ACCESS):
                return HTTPStatus.FORBIDDEN, {
                    "error": _("Administration permission required.")
                }

            owner = get_object_or_404(
                Owner.objects.select_related("character__character", "corporation"),
                id=owner_id,
            )
            owner_name = owner.name
            owner.delete()

            return HTTPStatus.OK, schema.TaskTriggerResponseSchema(
                success=True,
                message=_(
                    f"Owner {owner_name} and all associated data deleted successfully."
                ),
            )

        @api.post(
            "administration/tasks/queue/",
            response={
                HTTPStatus.OK: schema.TaskTriggerResponseSchema,
                HTTPStatus.FORBIDDEN: dict,
            },
            tags=self.tags,
            summary="Trigger global update tasks for all owners or characters/corporations",
        )
        def trigger_global_update(
            request, payload: schema.GlobalUpdateTaskRequest | None = None
        ):
            if not request.user.is_superuser:
                return HTTPStatus.FORBIDDEN, {
                    "error": _("Superuser permission required.")
                }

            target = payload.target if payload else "all"
            force_refresh = payload.force_refresh if payload else False

            update_all_blueprints.delay(
                force_refresh=force_refresh,
                target=target,
            )

            if target == "characters":
                msg = _("Queued Update All Characters")
            elif target == "corporations":
                msg = _("Queued Update All Corporations")
            else:
                msg = _("Queued Update All Owners")

            return HTTPStatus.OK, schema.TaskTriggerResponseSchema(
                success=True,
                message=msg,
            )
