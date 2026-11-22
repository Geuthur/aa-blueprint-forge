# Changelog

## [In Development] - Unreleased

<!--
> [!NOTE]
>

> [!TIP]
>

> [!IMPORTANT]
>

> [!WARNING]
>

> [!CAUTION]
>

Section Order:

### Added
### Fixed
### Changed
### Removed
-->

### Added

- [ADD] Reusable frontend components `OwnerPortrait` and `FilterButtonGroup`, replacing several inline copies.

- [ADD] The "Select Public BPOs" modal lists the stations of the owner's BPOs with a checkbox each, so all BPOs of a station can be selected or deselected with one click. BPOs without a known station are grouped under "Unknown location".

- [ADD] Frontend hooks per area (`Components/<Area>/Hooks`) that hold the queries and mutations of the Administration, Settings, Orders, Catalog, My Blueprints and menu views, plus the shared hooks `useFeedback`, `useCooldown` and `useUserData`.

- [ADD] Order history: orders stay traceable when the shop, its corporation or a user is deleted. Open orders of a deleted shop or buyer are cancelled, the buyer of a deleted shop gets a notification. The new "History" tab lists closed orders, the other tabs list open orders only. Includes a migration that fills the new order fields for existing orders.

- [ADD] The item table of an order shows the location of each blueprint to the seller and to order managers. Buyers do not see it, like in the catalog.

### Fixed

- [FIX] Discord webhook: a `ValueError` or `TypeError` of `dhooks_lite` (e.g. content over 2000 characters) no longer fails the Celery task, which would attach the webhook URL to the log record

- [FIX] React Query no longer retries 403, 404 and other 4xx answers three times, so the error shows at once instead of after about seven seconds: `Routing.tsx` uses `createQueryClient` of `aa-geuthur-react` (`^1.7.0`), which retries only network errors and 502/503/504

- [FIX] The type icon HTML carries the app name `aa-bpforge` as tooltip marker instead of the template name `aa-example`. The admin owner picture uses the public Alliance Auth functions `corporation_logo_url` and `character_portrait_url` instead of a private one.

- [FIX] The admin view `force-update` of an owner now requires the change permission (superuser); staff users without it get a 403 instead of queuing an update.

- [FIX] The texts "Invalid status. Must be one of: …", "Update task queued for …" and "Owner … deleted successfully." of the API and the messages of the views `add_character` and `add_corporation` could never be translated because they were f-strings inside `_()`. They use `.format()` now.

- [FIX] `thirdparty/discord.py` no longer logs the Discord webhook URL (with its token): not in the warning of a failed webhook, and not through the exception texts of `requests` and Celery's `MaxRetriesExceededError`.

- [FIX] The views `add_character` and `add_corporation` now require `bpforge.basic_access` before the EVE SSO redirect; `manage_access` or `full_access` alone no longer reach them. The charlink import for corporations requires `basic_access` in addition to `manage_access`.

- [FIX] The live status indicator and the order management tab used German source texts, so English and untranslated languages showed German. `useLivePing` now clears its timers on unmount.

- [FIX] The app page (`react_base`) now requires `bpforge.basic_access`, like the API and the menu entry. The view no longer reads the main character; the unused `character_id` parameter and context value are removed.

- [FIX] Dev dependencies: `minimatch` 11 (DoS, eslint ^10.15.0, typescript-eslint 8.72.2 with an override for `@typescript-eslint/typescript-estree`) and `zod` 4.6.7 (GHSA-mrhx-c7xc-m3w5).

- [FIX] ESI outages and limits did not retry the update tasks: `esi.decorators.rate_limit_retry_task` never applied because the tasks were not bound (`bind=True`), and the `UpdateManager` turned every ESI error except `TokenError` into an update status. `update_owner`, `update_blueprints`, `update_locations` and `update_structure_esi` are now bound and run their ESI calls inside the new `retry_task_on_esi_error()` in `providers.py` (with `DownTimeError` in the new `errors.py`), like the app template. It retries on `ESIErrorLimitException`, `ESIBucketLimitException`, `HTTPServerError` 502/503/504, `RequestError` and ESI's daily downtime (11:00 to 11:15 UTC, can be turned off with `DISABLE_DAILY_DOWNTIME_CHECK = True`). `_handle_update_exception` raises these errors (checked by `is_retryable_esi_error()`), and `execute_section` records them as a failed run of the section before raising, so the section shows the error and stays stale until the retry succeeds. Other errors (e.g. HTTP 500 or 404) still end in the update status only. `update_owner` runs its sections directly instead of calling the section tasks. `update_structure_esi` retries at most 3 times instead of without limit, since the retry backoff grows with each attempt.

- [FIX] The test settings set `DISABLE_DAILY_DOWNTIME_CHECK = True`, so the task tests no longer fail between 11:00 and 11:15 UTC. Only the downtime tests turn the check on with `override_settings`.

- [FIX] Tests no longer share the Redis cache with other processes. `testauth/settings/local.py` gives each test run its own random cache `KEY_PREFIX`. Before, ESI responses cached by a running testauth instance on the same Redis were returned instead of the pook responses. Redis stays the cache backend because Alliance Auth needs `django_redis`.

- [FIX] Order items no longer disappear when ESI stops returning their blueprint, for example after it was sold. The item keeps a copy of the blueprint values and is marked as "Blueprint no longer available". Includes a migration that fills the copy for existing items.

- [FIX] Tests use the shared factories and helpers of `aa-evesde-factory` (`UserFactory`, `EveCharacterFactory`, `EveCorporationInfoFactory`, `EveAllianceInfoFactory`, `add_character_to_user`, `add_new_token`) instead of local copies, so generated usernames are unique and can no longer match the superuser of a test class.

- [FIX] The "Select Public BPOs" modal showed "-" as location for BPOs in containers. It now shows the name of the station or structure.

- [FIX] Headers of the administration inspection view, the owner list and the section header wrap on small screens instead of overflowing the container, and the filter button groups scroll horizontally.

- [FIX] The pulsing menu and tab badges scaled up and down with their number. Only the glow around the badge pulses now.

- [FIX] BPOs directly in the hangar of a station or structure, without a container or office of the owner, stayed under "Unknown location". The location update now also resolves the name of these locations. Structures the owner has no access to stay under "Unknown location".

- Fixed `make coverage` exiting with 0 when tests failed. The reports are still created, and the target now exits with the status of the test run, or with the status of `coverage report` if the tests passed.

- [FIX] Real translations from the stale `weblate-translation` branch are applied to `frontend/i18n/<lng>/translation.json` and to the German `django.po`. Only strings that were empty or equal to English are filled, translations already on master are kept. `frontend/i18n/cs` and `frontend/i18n/sk` are added with all keys empty. The `.po` files are updated with `make translations`.

### Changed

- [CHANGE] CI and pre-commit run on Node 26 (LTS) instead of Node 24; npm packages updated (minor and patch, jsdom 31, @testing-library/jest-dom 8), no change in behavior.

- [CHANGE] `AccessQuerySet` and `AccessManager` live in `bpforge/managers/general.py` in the form of the template; `visible_to` and `manage_to` now filter by the real fields of `Owner` and `Blueprint` (they were unused and failed before).

- [CHANGE] The whole API requires `bpforge.basic_access` centrally (`basic_access_required` around the API URLs), including `menu/` and the administration endpoints. Users with `manage_access` or `full_access` but without `basic_access` lose access to the API and the pages; grant them `basic_access` as well.

- [CHANGE] `bpforge/thirdparty/discord.py` is now the Discord building block of the `aa-example` template (embed colors in the module, webhook sender included but unused); the order notifications moved to `bpforge/helpers/notifications.py`. Behavior and the Celery task name of `send_user_notification` are unchanged

- [CHANGE] The stylelint pre-commit hook now checks the source CSS in `frontend/src/` (built bundles stay excluded); its findings are fixed without visual change (hex colors as equivalent `rgb()`, CSS module classes in kebab-case)

- [CHANGE] Administration owner actions are one seamless icon `ButtonGroup` (update split dropdown inside) with tooltips, and `FilterButtonGroup` now comes from `aa-geuthur-react` 1.4.0 instead of a local copy (the BPC filter is `primary` like the others when active).

- [CHANGE] Permissions follow the app template: `General.Meta.permissions` is a plain tuple (same codenames and texts, migration `0008` only changes the stored options), the `General.Permission` choices and the helpers `get_perm`, `has_perm`, `has_any_perm` and `has_administration_access` are replaced by `General.objects` (`GeneralManager` in `bpforge/managers/general.py`: `has_basic_access`, `has_management_access`, `has_admin_access`). `bpforge/managers.py` moves to `bpforge/managers/blueprint.py`. Behaviour is unchanged; a new test checks all permission strings against `General.Meta.permissions`.

- [CHANGE] `bpforge/models/helpers/update_manager.py` follows the module of the app template: the shared base class `UpdateSection` holds only `get_sections()` and `method_name`, and the sections of an owner live in the new subclass `OwnerUpdateSection` (`blueprints`, `locations`, same values and labels, no migration). All imports use `OwnerUpdateSection`. The token error log of `need_update()` names the owner instead of the status row. The aggregated `get_status` of the template is not added, because the app has no `annotate_total_update_status()` and builds the owner status in the API itself. Behaviour is unchanged.

- [CHANGE] The `AppLogger` is created only once in `bpforge/providers.py`. `managers.py`, `models/helpers/update_manager.py`, `tasks.py` and `thirdparty/discord.py` import it with `from bpforge.providers import logger` instead of building their own; `models/blueprint.py` and `views.py` created a logger they never used, so it is removed there. Log records now carry the logger name `bpforge.providers` instead of the module name; the `[Blueprint Forge]` prefix is unchanged.

- [CHANGE] Language files other than `en` hold only real translations as Weblate writes them; untranslated strings are no longer stored as empty values, and missing keys fall back to English. `i18next-scanner` now maintains only `frontend/i18n/en/translation.json`. Removed empty entries per language: cs 373, de 30, es 351, fr-FR 353, it-IT 353, ja 346, ko-KR 346, nl-NL 353, pl-PL 353, ru 352, sk 373, uk 352, zh-Hans 346.

- [CHANGE] `aa-geuthur-react` raised to `^1.3.0`. The package bundles its own translations and registers them with i18next through `AaReactProvider`, so `Main.tsx` lists only the namespace `translation`, the copies under `bpforge/static/bpforge/i18n/<lng>/aa-geuthur-react.json` are removed and `make react-copy-translations` no longer copies them. Untranslated strings in `frontend/i18n/<lng>/translation.json` are empty instead of English (`i18next-scanner` writes the key as value only for `en`); `returnEmptyString: false` shows the English fallback at runtime. Translate on Weblate as before.

- [CHANGE] The frontend uses the shared React base of the npm package [aa-geuthur-react](https://github.com/Geuthur/aa-geuthur-react): tables, modals, loaders, menu, hooks, the base page and the utils are no longer copied into the app. The pages now use the container width of the package (640 to 1280 px) instead of `aa-section`. The `menu/` endpoint delivers the badges of the Orders and Settings links (`badge`, `has_errors`), and `MenuLink` has the optional field `badge`. The Overview link points to the root of the app, `overview/` redirects there.

- [CHANGE] The blueprint update logs a warning with the owner and the number of deleted blueprints when ESI returns no blueprints and all existing blueprints of the owner are deleted. The deletion itself is unchanged.

- [CHANGE] Only the buyer can cancel an order, and only while it is pending. Sellers and managers decline instead.

- [CHANGE] Only superusers can delete orders, and only closed orders from the "History" tab.

- [CHANGE] The orders menu badge also counts the open orders an order manager can manage, not only the user's own seller orders.

- [CHANGE] The item table of an order uses `BaseTable` and can be sorted.

- [CHANGE] The open order badges in the menu and on the order tabs look and pulse like the settings menu badge. The menu link and the tabs no longer glow.

- [CHANGE] Buttons use the Bootstrap 5 variants (`variant`, `size`) with the theme look defined as overrides under `.aa-react`; the custom `aa-btn` classes were removed. The order tabs use the Bootstrap nav pills with the same override approach. Frontend inline styles were replaced by CSS classes, layout-only CSS was replaced by Bootstrap utility classes, and missing `index.ts` files were added.

- [CHANGE] Both menus now share the same query options (5 minutes stale time, one retry, no refetch on window focus).

- [CHANGE] The generated `manifest.json` is excluded from the pre-commit end-of-file fixer.

- [CHANGE] Layout CSS of the settings page, owner cards and tables was replaced by Bootstrap utility classes, badge backgrounds use the Bootstrap `bg-*` classes with theme overrides under `.aa-react`, and `!important` was dropped where Bootstrap classes make it unnecessary.

- [CHANGE] The table filter fields use Bootstrap utility classes for their layout and share a single clear button component.

- [CHANGE] Frontend moved to `aa-geuthur-react` 1.5.0: owner cards, settings section, portrait, `initI18n`, `useUserSettings` and the design tokens come from the package; the local copies (owner settings, owner portrait, badges, forms, user settings calls) are removed. On the settings page the header of the owner section has rounded corners, owner cards with an error pulse, and a few German texts changed ("Wird gelöscht…", "Letzte Synchronisierung", "Update-Status wird geladen…").

- [CHANGE] Internal: eslint sorts CSS imports via `@/` into the `// Styles` group after the app imports, like the template `aa-example`. The group for relative imports is removed.

- [CHANGE] Internal: The frontend API calls are split by area into `Api/calls/{settings,catalog,myBlueprints,orders,administration}.ts`, each with its own query keys, replacing `Api/ApiCalls.ts` and `Api/query.ts`.

- [CHANGE] Uniform error format of the API: every error response of an endpoint is an `ErrorSchema` (`{"error": "<text>"}`) in the OpenAPI schema, and every endpoint lists its 403. Unknown owners and orders answer 404 with `{"error": "Owner not found."}` or `{"error": "Order not found."}` instead of `{"detail": "Not Found"}`. The unreachable `basic_access` checks in the endpoints are removed, `basic_access_required` covers them. Status codes are unchanged.

- [CHANGE] The frontend shows the reason the API gives for a failed action (e.g. "Permission Denied") instead of a fixed text (`apiErrorMessage` of `aa-geuthur-react`).

### Removed

- [REMOVED] Unused copy of the blueprint components in `Components/Blueprint`.

- [REMOVED] Unused CSS classes (`aa-bg-*`, `aa-color-*`, `aa-tab-*`, `aa-panel*` and others) and theme variables.

- [REMOVED] Unused `BaseModalQuery` mutation hooks.

<!-- Your changes go here -->

## [1.1.0] - 2026-10-25

### Added

- [ADD] Owner manual update endpoint `POST /bpforge/api/settings/owners/{owner_id}/update/` with Celery task queueing.

- [ADD] Owner deletion endpoint `DELETE /bpforge/api/settings/owners/{owner_id}/` with cascade deletion.

- [ADD] Batch update endpoint `POST /bpforge/api/settings/owners/update-all/` for all linked owners of the user.

- [ADD] Header `Update All` button with 60s cooldown timer in `OwnerSettingsSection`.

- [ADD] Row-level `Update` button and `Delete` button with `BaseModal` confirmation dialog on `OwnerSettingCard`.

- **Superuser View Unification**: Implemented 4 standardized KPI metric cards (`bg-body border-secondary h-100 shadow-sm`) with dynamic "Sync Issues" indicator (Green Shield when 0 issues, Red AlertTriangle with count badge).

- **Collapsible Global Task Administration**: Added collapsible Global Task Administration panel with global update task and Force Refresh switch (`data-testid="toggle-task-panel"`).

- **Collapsible Global Notification Groups**: Converted Global Notification Groups into a collapsible card panel with toggle button (`data-testid="toggle-notification-panel"`).

- **Search & ButtonGroup Filters**: Added unified owner search and ButtonGroup filters (`All`, `Characters`, `Corporations`, `Sync Issues`) in Superuser view.

- **Pulsing Error Indicator**: Added `has_errors` detection to `OwnerPublicSchema` and rendered pulsing warning indicator (`aa-btn-warning aa-btn-pulse` with `aa-pending-dot-container`) on `Browse Blueprints` in `OwnerCard` when an owner has active sync errors.

- Django Admin view for `Owner` model (`bpforge/admin.py`) with force update actions (bypassing cache), normal updates, inline update status inspection, and permission controls.

- Superuser API endpoint `DELETE /bpforge/api/superuser/owners/{owner_id}/` to allow superusers to delete owners and cascade associated blueprints/settings.

- Frontend Superuser Owner deletion action in `SuperuserOwnersTable` and `SuperuserPage` with a confirmation modal (`BaseModal`) before deletion is executed.

### Fixed

- [FIX] Removed plain translation keys that duplicated their plural forms (`_one`/`_other`) in the English and German translation files, which caused Weblate "duplicate string in file" warnings.
- Fixed invalid ORM field lookups in `bpforge.thirdparty.charlink_hook` (`character__character` and `corporation__corporation_id` in `is_character_added_annotation`).
- [FIX] Fixed the `import-headings` ESLint rule duplicating comments above the first import on every `--fix` pass, which could grow a file exponentially; added a unit test (`eslint-rules/import-headings.test.mjs`).

### Changed

- [CHANGE] Use the typographic ellipsis (`…`) instead of three dots in loading texts and placeholders; the translation keys changed accordingly.
- [CHANGE] Removed pulse and warning dot indicator from Overview `OwnerCard` `Browse Blueprints` button; the pulse notification is restricted to the `Settings` navigation item when user's own owner is affected.
- [CHANGE] Settings navigation item displays a pulsing red issue count badge (`aa-menu-badge-pulse`) instead of a dot when an ESI error or token error is present.
- [CHANGE] Refactored `SettingsPage` to use modular `BaseOwnerSettingsSection` and `BaseOwnerCard` for unified owner settings management.
- [CHANGE] Integrated `nuqs` URL query parameter (`?inspect=<ownerId>`) for the Superuser inspection view, enabling native browser back/forward navigation.
- [CHANGE] Centralized permission handling in `General.Permission` (`TextChoices`) with `General.get_perm`, `General.has_perm` and `General.has_any_perm`; permission codenames are unchanged (migration only updates model options).
- [CHANGE] Renamed the "Superuser" area to "Administration": API paths `superuser/...` -> `administration/...`, `api/superuser.py` -> `api/administration.py`, `Superuser*` schemas/pages/components/query keys -> `Administration*`, menu link `/administration/`.
- [CHANGE] Administration endpoints and the menu entry are now guarded by the `bpforge.full_access` permission instead of `is_superuser`; only the global update queue (`POST administration/tasks/queue/`) and `force_refresh` remain superuser-only (`force_refresh` by non-superusers returns 403).
- [CHANGE] Removed redundant `is_superuser` branches from `AccessQuerySet`/`AccessManager` and `user_is_global_order_manager`; the permission system decides.
- [CHANGE] `UserData` exposes `is_superuser`; the global task panel and the Force Refresh actions are only shown to superusers.
- [CHANGE] Aligned the frontend entry files with `aa-ledger`: `main.tsx` -> `Main.tsx`, `App.tsx` -> `Routing.tsx`, `configuration.ts` -> `src/constants.ts`, `index.css` -> `Styles/index.css`; i18n initialisation moved to `Main.tsx`.
- [CHANGE] The ESI status badge in the Administration owners table opens the new `AdministrationErrorModal` with the full error message when the owner has an error or a `token_error`; owners without errors keep a plain badge. `SettingsPage` is unchanged.
- [CHANGE] Moved all backend permission and order access logic into the `General` model (`has_administration_access`, `is_global_order_manager`, `is_corp_order_manager`, `can_manage_orders`, `can_manage_order`, `get_manageable_orders_filter`, `get_user_corporation_ids`); the loose module functions in `bpforge.models.general` were removed and all API endpoints, managers and hooks call the `General` methods. Behaviour is unchanged.
- [CHANGE] Consolidated the frontend formatting helpers in `Utils/format.ts` (`formatNumber`, `formatCompactNumber`, `formatIsk`, `formatDate`, `formatRelativeTime`, `formatEta`) with a single `en` locale fallback; `renderTooltip` now lives only in `Utils/bootsTrap.tsx` and `renderHtml` in `Utils/general.tsx`.
- [CHANGE] Replaced `BaseTable` with the shared implementation from `aa-ledger` (new toolbar, `variant` is now `default` or `light`, table styles moved to `Styles/table.css`); `onRowClick` is kept. Owner type badges in the settings use the `aa-ledger` colors (`primary` / `info`).
- [CHANGE] Replaced `pook` with `pookx` in the test dependencies.

## [1.0.2] - 2026-10-18

### Added

- Automatic deletion of blueprints during synchronization when they are no longer owned or present in ESI.
- Factory Boy factories for `bpforge` test data (`OwnerFactory`, `BlueprintFactory`, `OrderFactory`, `RequestFactory`, `GroupFactory`, `LocationFactory`, `OwnerUpdateStatusFactory`).
- Performance indexes on `Blueprint` (`(owner, runs)`, `(owner, is_offered)`, `(owner, eve_type)`, `(runs)`) and `Owner` (`(is_public)`, `(is_public, public_type)`).
- `BlueprintQuerySet.with_catalog_relations()` to skip unused location joins in public catalog views.

### Fixed

- Blueprint synchronization `IntegrityError` when multiple owners own blueprints with the same `item_id`. Blueprints now use a dedicated primary key (`id`) and enforce uniqueness per owner `(owner, item_id)`.
- Blueprint sync manager deduplicates incoming ESI items within a single batch and correctly preserves primary keys on bulk updates.
- Refactored backend tests to use Factory Boy factories instead of direct ORM model creation.
- Eliminated severe N+1 query storm on blueprint location parents by preloading `location__parent` in `with_api_relations()`.
- Eliminated per-owner count query storm in `list_public_blueprints` by annotating `selective_bpo_count` with conditional aggregation.

## [1.0.1] - 2026-10-18

### Added

- Blueprint search in the overview catalog directory with quick access and direct preview on provider cards.
- Loading animations for tables during data fetching.
- Dedicated `/overview/` route for direct navigation and bookmarking.
- Dedicated order management view for managers with overview, status tracking, and deletion.
- Role-based manager permissions for order oversight (global and corporation-scoped).
- Direct order links in Discord notifications for buyers, sellers, and managers.

### Changed

- Full theme compatibility for both Alliance Auth light (Flatly) and dark (Darkly) themes with adaptive tokens for panels, tables, controls, and headings.
- Reorganized frontend component structure into page-aligned directories (`Main/`, `MyBlueprints/`, `Orders/`, `Settings/`, `BlueprintTable/`) for improved modularity and maintainability.
- Standardized page section containers, banners, and empty/error states to React-Bootstrap `Card` and `Card.Body` with `bg-secondary text-light` for consistent styling across all views.
- Refactored `BpoSelectionModal` in settings to utilize `BaseTable` with pagination, sorting, and full row toggle support.
- Improved menu navigation to route cleanly without persisting search filters across pages.
- Migrated modals across the application to the standardized `BaseModal` design.
- Synchronized order tab selection with URL query parameters.
- Refactored owner display name and blueprint serialization into reusable helpers to eliminate code duplication across API endpoints and Discord notifications.

### Fixed

- Cache invalidation and badge updates on order deletion and status changes.

## [1.0.0] - 2026-10-15

### Added

- Interactive blueprint catalog for browsing and filtering available Blueprint Originals (BPOs) and Copies (BPCs) across characters and corporations.
- Multi-item batch ordering system with shopping cart, copy/run customization, customer notes, and order workflow management (Pending, Accepted, Delivered, Declined, Cancelled).
- Personal and corporation blueprint inventory overview (`My Blueprints`) with KPI statistics and material/time efficiency (ME/TE) details.
- Flexible blueprint offering and visibility controls per owner: public/private shop toggle, offering mode (all, BPO only, BPC only), and selective BPO offering.
- Automated EVE Online ESI synchronization for blueprints, stations, and citadels with status badges and error tracking in settings.
- Alliance Auth and Discord notifications for new orders and order status changes with configurable global and owner-specific recipient groups.
- Dedicated superuser administration view (`/superuser/`) for managing all owners, triggering manual sync tasks, inspecting raw inventories, and configuring notification groups.
- Full localization support for English and German.

<!-- Links -->

[1.0.0]: https://github.com/Geuthur/aa-blueprint-forge/compare/v...v1.0.0 "v1.0.0"
[1.0.1]: https://github.com/Geuthur/aa-blueprint-forge/compare/v1.0.0...v1.0.1 "v1.0.1"
[1.0.2]: https://github.com/Geuthur/aa-blueprint-forge/compare/v1.0.1...v1.0.2 "v1.0.2"
[1.1.0]: https://github.com/Geuthur/aa-blueprint-forge/compare/v1.0.2...v1.1.0 "v1.1.0"
[in development]: https://github.com/Geuthur/aa-blueprint-forge/compare/v1.1.0...HEAD "In Development"
