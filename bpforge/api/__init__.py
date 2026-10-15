# Third Party
from ninja import NinjaAPI
from ninja.security import django_auth

# Django
from django.conf import settings

# AA Blueprint Forge
from bpforge.api import general, my_blueprints, orders, blueprints, superuser

api = NinjaAPI(
    title="AA Blueprint Forge API",
    version="0.5.0",
    urls_namespace="bpforge:api",
    auth=django_auth,
    openapi_url=settings.DEBUG and "/openapi.json" or "",
)


def setup(ninja_api):
    general.ApiEndpoints(ninja_api)
    blueprints.ApiEndpoints(ninja_api)
    my_blueprints.ApiEndpoints(ninja_api)
    orders.ApiEndpoints(ninja_api)
    superuser.ApiEndpoints(ninja_api)


# Initialize API endpoints
setup(api)
