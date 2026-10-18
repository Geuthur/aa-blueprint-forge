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

<!-- Your changes go here -->

## [1.0.1] - 2026-10-18

### Added

- Blueprint search in the overview catalog directory with quick access and direct preview on provider cards.
- Loading animations for tables during data fetching.
- Dedicated `/overview/` route for direct navigation and bookmarking.
- Dedicated order management view for managers with overview, status tracking, and deletion.
- Role-based manager permissions for order oversight (global and corporation-scoped).
- Direct order links in Discord notifications for buyers, sellers, and managers.

### Changed

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
[in development]: https://github.com/Geuthur/aa-blueprint-forge/compare/v1.0.1...HEAD "In Development"
