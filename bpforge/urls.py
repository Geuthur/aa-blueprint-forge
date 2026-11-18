"""App URLs"""

# Django
from django.urls import path, re_path

# Alliance Auth
from allianceauth.authentication.decorators import decorate_url_patterns

# AA Blueprint Forge
from bpforge import views
from bpforge.api import api
from bpforge.api.auth import basic_access_required

app_name: str = "bpforge"  # pylint: disable=invalid-name

# Every URL of the API (endpoints, schema and docs) requires `basic_access`
api_patterns, api_app_name, api_namespace = api.urls
api_patterns = decorate_url_patterns(
    (api_patterns, api_app_name), basic_access_required
)[0]

urlpatterns = [
    path("corporation/add/", views.add_corporation, name="add_corporation"),
    path("character/add/", views.add_character, name="add_character"),
    # -- API System
    re_path(r"^api/", (api_patterns, api_app_name, api_namespace)),
    # -- React SPA Routes
    re_path(
        r"^(?!api/).*$",
        views.react_base,
        name="react_base",
    ),
]
