"""Admin site configuration for Blueprint Forge."""

# Django
from django.contrib import admin, messages
from django.contrib.humanize.templatetags.humanize import naturaltime
from django.db.models import Max
from django.http import HttpResponseRedirect
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

# Alliance Auth
from allianceauth.eveonline.evelinks import eveimageserver

# AA Blueprint Forge
from bpforge.models.blueprint import Owner, OwnerUpdateStatus
from bpforge.tasks import update_owner


class OwnerUpdateStatusAdminInline(admin.TabularInline):
    model = OwnerUpdateStatus
    fields = (
        "section",
        "_is_success",
        "_is_token_ok",
        "error_message",
        "last_run_at",
        "last_run_finished_at",
    )
    readonly_fields = (
        "section",
        "_is_success",
        "_is_token_ok",
        "error_message",
        "last_run_at",
        "last_run_finished_at",
    )
    ordering = ["section"]
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):  # pylint: disable=unused-argument
        return False

    def has_change_permission(
        self, request, obj=None
    ):  # pylint: disable=unused-argument
        return False

    def has_delete_permission(
        self, request, obj=None
    ):  # pylint: disable=unused-argument
        return False

    @admin.display(boolean=True, description=_("Success"))
    def _is_success(self, obj: OwnerUpdateStatus) -> bool | None:
        return obj.is_success

    @admin.display(boolean=True, description=_("Token OK"))
    def _is_token_ok(self, obj: OwnerUpdateStatus) -> bool:
        return not obj.has_token_error


@admin.register(Owner)
class OwnerAdmin(admin.ModelAdmin):
    """Admin Interface for Blueprint Owners."""

    list_display = (
        "_entity_pic",
        "_name",
        "_owner_type",
        "user",
        "is_public",
        "public_type",
        "selective_bpo_enabled",
        "_blueprint_count",
        "_last_update_at",
    )
    list_display_links = ("_entity_pic", "_name")
    list_filter = (
        "is_public",
        "public_type",
        "selective_bpo_enabled",
    )
    search_fields = (
        "user__username",
        "character__character__character_name",
        "corporation__corporation_name",
    )
    actions = [
        "force_update_selected_owners",
        "update_selected_owners",
    ]
    inlines = (OwnerUpdateStatusAdminInline,)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return (
            qs.select_related(
                "user",
                "character__character",
                "corporation",
            )
            .prefetch_related("bpforge_blueprints", "bpforge_update_status")
            .annotate(last_update_at=Max("bpforge_update_status__last_run_finished_at"))
        )

    @admin.display(description="")
    def _entity_pic(self, obj: Owner):
        if obj.corporation_id:
            url = eveimageserver._eve_entity_image_url(
                "corporation", obj.corporation_id, 32
            )
        elif obj.character_id and obj.character and obj.character.character:
            url = eveimageserver._eve_entity_image_url(
                "character", obj.character.character.character_id, 32
            )
        else:
            return "-"
        return format_html(
            '<img src="{}" class="img-circle" width="32" height="32">', url
        )

    @admin.display(description=_("Owner Name"))
    def _name(self, obj: Owner) -> str:
        return obj.name

    @admin.display(description=_("Type"))
    def _owner_type(self, obj: Owner):
        return _("Corporation") if obj.is_corporation else _("Character")

    @admin.display(description=_("Blueprints"))
    def _blueprint_count(self, obj: Owner) -> int:
        return obj.bpforge_blueprints.count()

    @admin.display(ordering="last_update_at", description=_("Last Update"))
    def _last_update_at(self, obj: Owner):
        return (
            naturaltime(obj.last_update_at)
            if getattr(obj, "last_update_at", None)
            else "-"
        )

    @admin.action(description=_("Force update selected owners (bypass cache)"))
    def force_update_selected_owners(self, request, queryset):
        count = 0
        for owner in queryset:
            update_owner.delay(owner_pk=owner.pk, force_refresh=True)
            count += 1
        self.message_user(
            request,
            _("Force update queued for %(count)d owner(s).") % {"count": count},
            messages.SUCCESS,
        )

    @admin.action(description=_("Update selected owners (cached)"))
    def update_selected_owners(self, request, queryset):
        count = 0
        for owner in queryset:
            update_owner.delay(owner_pk=owner.pk, force_refresh=False)
            count += 1
        self.message_user(
            request,
            _("Update queued for %(count)d owner(s).") % {"count": count},
            messages.SUCCESS,
        )

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "<int:owner_id>/force-update/",
                self.admin_site.admin_view(self.force_update_owner_view),
                name="bpforge_owner_force_update",
            ),
        ]
        return custom_urls + urls

    def force_update_owner_view(self, request, owner_id: int):
        owner = self.get_object(request, str(owner_id))
        if owner:
            update_owner.delay(owner_pk=owner.pk, force_refresh=True)
            self.message_user(
                request,
                _("Force update queued for %(name)s.") % {"name": owner.name},
                messages.SUCCESS,
            )
        return HttpResponseRedirect(reverse("admin:bpforge_owner_changelist"))

    def has_add_permission(self, request):  # pylint: disable=unused-argument
        return False

    def has_change_permission(
        self, request, obj=None
    ):  # pylint: disable=unused-argument
        return request.user.is_superuser

    def has_delete_permission(
        self, request, obj=None
    ):  # pylint: disable=unused-argument
        return request.user.is_superuser

    def has_module_permission(self, request):
        return request.user.is_superuser
