"""Hook into Alliance Auth"""

# Django
# Django
from django.utils.translation import gettext_lazy as _

# Alliance Auth
from allianceauth import hooks
from allianceauth.services.hooks import MenuItemHook, UrlHook

# AA Blueprint Forge
from bpforge import app_settings, urls


class BlueprintForgeMenuItem(MenuItemHook):
    """This class ensures only authorized users will see the menu entry"""

    def __init__(self):
        super().__init__(
            f"{app_settings.BPFORGE_APP_NAME}",
            "fas fa-hammer fa-fw",
            "bpforge:react_base",
            navactive=["bpforge:"],
        )

    def render(self, request):
        if request.user.has_perm("bpforge.basic_access"):
            return MenuItemHook.render(self, request)
        return ""


@hooks.register("menu_item_hook")
def register_menu():
    """Register the menu item"""

    return BlueprintForgeMenuItem()


@hooks.register("url_hook")
def register_urls():
    """Register app urls"""

    return UrlHook(urls, "bpforge", r"^bpforge/")


@hooks.register("charlink")
def register_charlink_hook():
    return "bpforge.thirdparty.charlink_hook"
