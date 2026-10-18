"""Initialize the app"""

__version__ = "1.0.2"
__title__ = "Blueprint Forge"

__package_name__ = "aa-blueprint-forge"
__app_name__ = "bpforge"
__esi_compatibility_date__ = "2026-08-18"
__app_name_useragent__ = "AA-Blueprint-Forge"
__github_url__ = f"https://github.com/Geuthur/{__package_name__}"

__operations__ = [
    "GetUniverseStationsStationId",
    "GetUniverseStructuresStructureId",
    "GetCorporationsCorporationIdAssets",
    "GetCorporationsCorporationIdBlueprints",
    "GetCorporationsCorporationIdIndustryJobs",
    "GetCharactersCharacterIdAssets",
    "GetCharactersCharacterIdBlueprints",
    "GetCharactersCharacterIdIndustryJobs",
    "PostUniverseNames",
]
