"""
App Settings
"""

# Django
from django.conf import settings

# Set Naming on Auth Hook
BPFORGE_APP_NAME = getattr(settings, "BPFORGE_APP_NAME", "Blueprint Forge")

# Task Settings
# Global timeout for tasks in seconds to reduce task accumulation during outages.
BPFORGE_TASKS_TIME_LIMIT = getattr(
    settings, "BPFORGE_TASKS_TIME_LIMIT", 1200
)  # 20 minutes

# Maximum Number of Objects processed per run of DJANGO Batch Method
BPFORGE_BULK_BATCH_SIZE = getattr(settings, "BPFORGE_BULK_BATCH_SIZE", 500)

# Stale Settings
# Minutes until an object is considered stale and should be updated.
BPFORGE_STALE_TYPES = getattr(
    settings,
    "BPFORGE_STALE_TYPES",
    {
        "blueprints": 60,
        "locations": 720,
    },
)
