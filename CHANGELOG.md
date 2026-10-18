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

- Dedicated Order Management view ("Auftragsverwaltung") for managers on the Orders page with open order count badge and live status tracking.
- Global order manager access for superusers, users with `bpforge.full_access`, and members of global order notification groups (`order_created_groups`, `order_status_groups`), enabling full oversight, status management, and deletion across all orders globally.
- Corporation-scoped order manager access for users with `bpforge.manage_access`, restricting order oversight, status management, and deletion to their corporation and its members.
- Complete order deletion endpoint (`DELETE /api/orders/{order_id}/`) with cascade removal of associated request items and UI confirmation modal.
- Quick "Review Order" button beside the `Type:` filter in the blueprint catalog table for easy access when blueprints are selected.
- Tailored direct links in Discord order notifications routing managers directly to Order Management (`?tab=manage`) and buyers/sellers to their respective tabs.
- Red danger styling (`.aa-nav-danger`) and shield alert icon for the Superuser menu item in navigation.

### Changed

- Replaced standard Bootstrap deletion modal with `BaseModal` and inner `.aa-panel` container in `OrderCard` for consistent theme integration.
- Migrated BPO selection modal (`BpoSelectionModal`) in settings to `BaseModal` with an inner `.aa-panel` container and unified button styling.
- URL query parameter synchronization (`?tab=...`) in `OrdersPage` allowing direct deep-linking and bookmarking of order tabs.

### Fixed

- Order list and badge automatic update upon order deletion and status update by fixing `queryKeys.Orders` prefix matching for React Query cache invalidation.

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
[in development]: https://github.com/Geuthur/aa-blueprint-forge/compare/v1.0.0...HEAD "In Development"
