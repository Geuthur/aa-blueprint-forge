# AA Blueprint Forge<a name="aa-blueprint-forge"></a>

> [!WARNING]
> Before you create Models, etc remove the 0001_initial.py from migrations folder if you dont have created own one.

A Blueprint Forge App for Alliance Auth

______________________________________________________________________

<!-- mdformat-toc start --slug=github --maxlevel=6 --minlevel=1 -->

- [AA Blueprint Forge](#aa-blueprint-forge)
  - [Features](#features)
  - [Installation](#installation)
    - [Step 1 - Install the Package](#step-1---install-the-package)
    - [Step 2 - Configure Alliance Auth](#step-2---configure-alliance-auth)
    - [Step 3 - Add the Scheduled Tasks](#step-3---add-the-scheduled-tasks)
    - [Step 3.1 - (Optional) Add own Logger File](#step-31---optional-add-own-logger-file)
    - [Step 4 - Migrate & Preload EVE SDE Data](#step-4---migrate--preload-eve-sde-data)
    - [Step 4.1 - Migrate App and collect static](#step-41---migrate-app-and-collect-static)
    - [Step 5 - Setting up Permissions](#step-5---setting-up-permissions)
    - [Step 6 - (Optional) Setting up Compatibilies](#step-6---optional-setting-up-compatibilies)
  - [Frontend Development (React SPA)](#frontend-development-react-spa)
    - [Tech Stack](#tech-stack)
    - [Frontend Makefile Commands](#frontend-makefile-commands)
    - [Local Frontend Development](#local-frontend-development)
  - [Translations](#translations)
  - [Contributing](#contributing)

<!-- mdformat-toc end -->

## Features<a name="features"></a>

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

## Frontend Development (React SPA)<a name="frontend-development-react-spa"></a>

The user interface of AA Blueprint Forge is built as a modern React Single-Page Application (SPA) located in the `frontend/` directory.

### Tech Stack<a name="tech-stack"></a>

- **Framework**: React 19, TypeScript
- **Bundler & Tooling**: Vite 8 (`@vitejs/plugin-react-swc`), AllianceAuth styles from `frontend/src/index.css`
- **UI Components & Icons**: React-Bootstrap, Lucide Icons (`lucide-react`)
- **Data & Tables**: TanStack React Query (`@tanstack/react-query`), TanStack Table (`@tanstack/react-table`)
- **API Client**: `openapi-fetch` with types generated via `openapi-typescript`
- **Testing**: Vitest with `@testing-library/react` and `jsdom`
- **Localization**: `i18next` & `react-i18next` (12 languages)

### Frontend Makefile Commands<a name="frontend-makefile-commands"></a>

You can control the frontend build, test, and development workflows directly from the repository root:

| Command                        | Description                                                             |
| :----------------------------- | :---------------------------------------------------------------------- |
| `make react-dev`               | Starts the Vite development server with proxy to backend                |
| `make react-build`             | Runs TypeScript compilation (`tsc -b`) and Vite production build        |
| `make react-test`              | Runs Vitest unit tests                                                  |
| `make react-lint`              | Runs ESLint verification                                                |
| `make react-eslint`            | Runs ESLint with automated fixes (`--fix`)                              |
| `make react-test-build`        | Runs build, asset copy, translation sync, and `collectstatic`           |
| `make react-release`           | Runs full release build (build, i18n scan, asset copy, `collectstatic`) |
| `make react-copy-assets`       | Copies Vite production build artifacts to Django's static directory     |
| `make react-copy-translations` | Copies frontend i18n translations to Django's static directory          |
| `make react-translations`      | Scans source code and updates i18n translation files                    |
| `make react-openapi`           | Exports Django Ninja OpenAPI schema and regenerates TypeScript types    |
| `make react-clean`             | Cleans React build directory                                            |

### Local Frontend Development<a name="local-frontend-development"></a>

1. **Install dependencies**:

   ```shell
   cd frontend
   npm install
   ```

1. **Start Vite development server**:

   ```shell
   # Inside frontend/
   npm run dev

   # Or from repository root:
   make react-dev
   ```

1. **Run tests and linter**:

   ```shell
   make react-test
   make react-lint
   ```

## Translations<a name="translations"></a>

[![Translations](https://weblate.geuthur.de/widget/allianceauth/aa-blueprint-forge/multi-auto.svg)](https://weblate.geuthur.de/engage/allianceauth/)

Help us translate this app into your language or improve existing translations. Join our team!"

## Contributing<a name="contributing"></a>

You want to improve the project?
Please ensure you read the [Contribution Guidelines]

<!-- MD Links -->

[contribution guidelines]: https://github.com/Geuthur/aa-blueprint-forge/blob/master/CONTRIBUTING.md "Contribution Guidelines"
