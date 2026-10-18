# AA Blueprint Forge<a name="aa-blueprint-forge"></a>

A Blueprint Forge App for Alliance Auth

______________________________________________________________________

<!-- mdformat-toc start --slug=github --maxlevel=6 --minlevel=1 -->

- [AA Blueprint Forge](#aa-blueprint-forge)
  - [Features](#features)
  - [Screenshots](#screenshots)
  - [Installation](#installation)
    - [Step 1 - Install the Package](#step-1---install-the-package)
    - [Step 2 - Configure Alliance Auth](#step-2---configure-alliance-auth)
    - [Step 3 - Add the Scheduled Tasks](#step-3---add-the-scheduled-tasks)
    - [Step 3.1 - (Optional) Add own Logger File](#step-31---optional-add-own-logger-file)
    - [Step 4 - Migrate & Preload EVE SDE Data](#step-4---migrate--preload-eve-sde-data)
    - [Step 4.1 - Migrate App and collect static](#step-41---migrate-app-and-collect-static)
    - [Step 5 - Setting up Permissions](#step-5---setting-up-permissions)
    - [Step 6 - (Optional) Setting up Compatibilies](#step-6---optional-setting-up-compatibilies)
  - [Translations](#translations)
  - [Contributing](#contributing)

<!-- mdformat-toc end -->

## Features<a name="features"></a>

- **Interactive Blueprint Catalog & Directory**:
  - Browse public blueprints offered by characters and corporations across your alliance.
  - Global blueprint search in the catalog directory with real-time preview of matching blueprints on provider cards.
  - Filter blueprints by type (Originals / BPOs, Copies / BPCs), group, and location.
  - Dedicated `/overview/` route with direct navigation and deep-linking into provider catalogs.
- **Batch Ordering System & Shopping Cart**:
  - Add multiple blueprints across different providers into a unified shopping cart.
  - Customize requested runs and copy quantities per item with optional customer notes.
  - Complete order workflow with status tracking (Pending, Accepted, Delivered, Declined, Cancelled).
  - Dedicated order management dashboard with tab filtering, order history, and deletion.
  - Role-based manager permissions for order oversight (global and corporation-scoped).
- **Personal & Corporation Inventory (`My Blueprints`)**:
  - Comprehensive overview of your own personal and corporation blueprint inventories.
  - Interactive KPI summary cards for quick filtering between BPOs and BPCs.
  - Detailed blueprint stats including Material Efficiency (ME), Time Efficiency (TE), runs, and storage locations.
- **Flexible Catalog Offering & Privacy Controls**:
  - Toggle public or private visibility for each character and corporation catalog.
  - Configurable offering modes: Offer all blueprints, BPOs only, or BPCs only.
  - Selective BPO offering: Selectively publish specific BPOs while keeping sensitive blueprints unlisted.
- **Automated EVE Online ESI Synchronization**:
  - Background synchronization for blueprints, character/corporation assets, stations, and citadels via Celery tasks.
  - Live status indicators, timestamp tracking, and error reporting in the settings dashboard.
- **Discord & Alliance Auth Notifications**:
  - Instant Discord notifications for new orders and order status changes with direct order links.
  - Configurable notification recipient groups globally and per owner.
- **Superuser Administration Dashboard**:
  - Dedicated `/superuser/` administration view to inspect all owners and raw inventories across the installation.
  - On-demand sync task triggers and global notification group configuration.
- **Modern Responsive React SPA**:
  - Built with React, TypeScript, and Vite for a fast and fluid user experience.
  - Dark-mode optimized design with responsive tables, loading animations, and standardized modals.
- **Multi-Language Support**:
  - Full localization support for English and German.

## Screenshots<a name="screenshots"></a>

![Image: overview]
![Image: superuser]
![Image: orders]
![Image: blueprints]

## Installation<a name="installation"></a>

> [!NOTE]
> AA Blueprint Forge needs at least Alliance Auth v5
> Please make sure to update your Alliance Auth before you install this APP

### Step 1 - Install the Package<a name="step-1---install-the-package"></a>

Make sure you're in your virtual environment (venv) of your Alliance Auth then install the pakage.

```shell
pip install aa-blueprint-forge
```

### Step 2 - Configure Alliance Auth<a name="step-2---configure-alliance-auth"></a>

Configure your Alliance Auth settings (`local.py`) as follows:

```python
INSTALLED_APPS = [
    # other apps
    "eve_sde",  # only if it not already existing
    "bpforge",
    # other apps?
]

# This line is right below the `INSTALLED_APPS` list, if not already exist!
INSTALLED_APPS = ["modeltranslation"] + INSTALLED_APPS
```

### Step 3 - Add the Scheduled Tasks<a name="step-3---add-the-scheduled-tasks"></a>

To set up the Scheduled Tasks add following code to your `local.py`

```python
if "bpforge" in INSTALLED_APPS:
    CELERYBEAT_SCHEDULE["AA Blueprint Forge :: Update Blueprints"] = {
        "task": "bpforge.tasks.update_all_blueprints",
        "schedule": 600,
    }
```

### Step 3.1 - (Optional) Add own Logger File<a name="step-31---optional-add-own-logger-file"></a>

To set up the Logger add following code to your `local.py`
Ensure that you have writing permission in logs folder.

```python
LOGGING["handlers"]["bpforge_file"] = {
    "level": "INFO",
    "class": "logging.handlers.RotatingFileHandler",
    "filename": os.path.join(BASE_DIR, "log/bpforge.log"),
    "formatter": "verbose",
    "maxBytes": 1024 * 1024 * 5,
    "backupCount": 5,
}
LOGGING["loggers"]["extensions.bpforge"] = {
    "handlers": ["bpforge_file"],
    "level": "DEBUG",
}
```

### Step 4 - Migrate & Preload EVE SDE Data<a name="step-4---migrate--preload-eve-sde-data"></a>

AA Blueprint Forge uses EVE SDE data to map IDs to names for EveTypes. You will need to preload some data from SDE once.

```shell
python manage.py migrate eve_sde
python manage.py esde_load_sde
```

### Step 4.1 - Migrate App and collect static<a name="step-41---migrate-app-and-collect-static"></a>

Migrate the app and collect static.

```shell
python manage.py migrate bpforge
python manage.py collectstatic --noinput
```

### Step 5 - Setting up Permissions<a name="step-5---setting-up-permissions"></a>

With the Following IDs you can set up the permissions for Blueprint Forge

| ID              | Description                    | Details                                                                         |
| :-------------- | :----------------------------- | :------------------------------------------------------------------------------ |
| `basic_access`  | Can access Blueprint Forge     | All members with this permission can access the Blueprint Forge module.         |
| `manage_access` | Can Manage Blueprint Forge     | Can manage application settings and data.                                       |
| `full_access`   | Full access to Blueprint Forge | Administrative access with full management permissions for the Blueprint Forge. |

### Step 6 - (Optional) Setting up Compatibilies<a name="step-6---optional-setting-up-compatibilies"></a>

The Following Settings can be setting up in the `local.py`

- BPFORGE_APP_NAME: `"YOURNAME"` - Set the name of the APP
- BPFORGE_TASKS_TIME_LIMIT: `7200` - Defines the time (in seconds) a task will timeout

If you set up BPFORGE_LOGGER_USE to `True` you need to add the following code below:

## Translations<a name="translations"></a>

[![Translations](https://weblate.geuthur.de/widget/allianceauth/aa-blueprint-forge/multi-auto.svg)](https://weblate.geuthur.de/engage/allianceauth/)

Help us translate this app into your language or improve existing translations. Join our team!"

## Contributing<a name="contributing"></a>

You want to improve the project?
Please ensure you read the [Contribution Guidelines]

<!-- MD Links -->

[contribution guidelines]: https://github.com/Geuthur/aa-blueprint-forge/blob/master/CONTRIBUTING.md "Contribution Guidelines"
[image: blueprints]: https://raw.githubusercontent.com/geuthur/aa-blueprint-forge/master/docs/images/blueprints.png "Blueprint Forge Blueprints"
[image: orders]: https://raw.githubusercontent.com/geuthur/aa-blueprint-forge/master/docs/images/orders.png "Blueprint Forge Orders"
[image: overview]: https://raw.githubusercontent.com/geuthur/aa-blueprint-forge/master/docs/images/overview.png "Blueprint Forge Overview"
[image: superuser]: https://raw.githubusercontent.com/geuthur/aa-blueprint-forge/master/docs/images/superuser.png "Blueprint Forge Superuser"
