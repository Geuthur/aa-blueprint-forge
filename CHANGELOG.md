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

- [ADD] Frontend hooks per area (`Components/<Area>/Hooks`) that hold the queries and mutations of the Administration, Settings, Orders, Catalog, My Blueprints and menu views, plus the shared hooks `useFeedback`, `useCooldown` and `useUserData`.

### Fixed

- [FIX] Headers of the administration inspection view, the owner list and the section header wrap on small screens instead of overflowing the container, and the filter button groups scroll horizontally.

### Changed

- [CHANGE] Buttons use the Bootstrap 5 variants (`variant`, `size`) with the theme look defined as overrides under `.aa-react`; the custom `aa-btn` classes were removed. The order tabs use the Bootstrap nav pills with the same override approach. Frontend inline styles were replaced by CSS classes, layout-only CSS was replaced by Bootstrap utility classes, and missing `index.ts` files were added.

- [CHANGE] Both menus now share the same query options (5 minutes stale time, one retry, no refetch on window focus).

- [CHANGE] The generated `manifest.json` is excluded from the pre-commit end-of-file fixer.

- [CHANGE] Layout CSS of the settings page, owner cards and tables was replaced by Bootstrap utility classes, badge backgrounds use the Bootstrap `bg-*` classes with theme overrides under `.aa-react`, and `!important` was dropped where Bootstrap classes make it unnecessary.

- [CHANGE] The table filter fields use Bootstrap utility classes for their layout and share a single clear button component.

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
