"""App URLs"""

# Django
# pylint: disable=unused-import
from django.urls import path, re_path

# AA Blueprint Forge
from bpforge import views

# pylint: disable=unused-import
from bpforge.api import api

app_name: str = "bpforge"  # pylint: disable=invalid-name

urlpatterns = [
    path("corporation/add/", views.add_corporation, name="add_corporation"),
    path("character/add/", views.add_character, name="add_character"),
    # -- API System
    re_path(r"^api/", api.urls),
    # -- React SPA Routes
    re_path(
        r"^(?!api/).*$",
        views.react_base,
        name="react_base",
    ),
]
