"""Helpers for ESI tests with pook."""

# Django
from django.core.cache import cache

ESI_BASE_URL = "https://esi.evetech.net"


def blueprints_url(owner) -> str:
    """Return the ESI URL of the blueprints of a character owner."""
    return (
        f"{ESI_BASE_URL}/characters/{owner.character.character.character_id}/blueprints"
    )


def assets_url(owner) -> str:
    """Return the ESI URL of the assets of a character owner."""
    return f"{ESI_BASE_URL}/characters/{owner.character.character.character_id}/assets"


def structure_url(structure_id: int) -> str:
    """Return the ESI URL of a structure."""
    return f"{ESI_BASE_URL}/universe/structures/{structure_id}"


def clear_esi_limits(owner) -> None:
    """Remove the ESI error limit and the buckets of a character owner from the cache."""
    character_id = owner.character.character.character_id
    cache.delete("esi_error_limit_reset")
    cache.delete(f"esi:bucket:char-industry:{character_id}")
    cache.delete(f"esi:bucket:char-asset:{character_id}")
