// React
import React, { useMemo, useState } from "react";

// Third Party
import { createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, RefreshCw, Trash2, Users } from "lucide-react";
import { Alert, Button, ButtonGroup, Card, Dropdown, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { OwnerSettingSchema } from "@/Api/schema";
import { AdministrationErrorModal } from "@/Components/Administration/AdministrationErrorModal";
import { getEsiStatusBadgeClass } from "@/Components/Administration/esiStatus";
import BaseTable from "@/Components/Base/BaseTable/BaseTable";
import { OwnerPortrait } from "@/Components/Base/OwnerPortrait";
import styles from "@/Styles/modules/Administration.module.css";
import { renderTooltip } from "@/Utils";
import { imageServer } from "@/Utils/eveOnline";

interface AdministrationOwnersTableProps {
  owners?: OwnerSettingSchema[];
  isLoading: boolean;
  isError: boolean;
  updatingOwnerId: number | null;
  taskFeedback: { variant: "success" | "danger"; message: string } | null;
  onDismissFeedback: () => void;
  onInspect: (owner: OwnerSettingSchema) => void;
  onEdit: (owner: OwnerSettingSchema) => void;
  isSuperuser: boolean;
  onTriggerUpdate: (ownerId: number, forceRefresh: boolean) => void;
  onDelete: (owner: OwnerSettingSchema) => void;
}

export const AdministrationOwnersTable: React.FC<AdministrationOwnersTableProps> = ({
  owners,
  isLoading,
  isError,
  updatingOwnerId,
  taskFeedback,
  onDismissFeedback,
  onInspect,
  onEdit,
  isSuperuser,
  onTriggerUpdate,
  onDelete,
}) => {
  const { t } = useTranslation();
  // Owner whose ESI error is shown in the modal
  const [errorOwner, setErrorOwner] = useState<OwnerSettingSchema | null>(null);

  const columns = useMemo<ColumnDef<OwnerSettingSchema, unknown>[]>(() => {
    const columnHelper = createColumnHelper<OwnerSettingSchema>();

    return [
      columnHelper.display({
        id: "avatar",
        header: () => null,
        size: 48,
        enableSorting: false,
        cell: ({ row }) => {
          const owner = row.original;
          const avatarUrl =
            owner.portrait_url ||
            (owner.is_corporation && owner.corporation_id
              ? imageServer("corporations", owner.corporation_id, 32)
              : owner.character_id
                ? imageServer("characters", owner.character_id, 32)
                : null);

          return (
            <OwnerPortrait
              src={avatarUrl}
              type={owner.is_corporation ? "corporation" : "character"}
              size="sm"
              shape="rounded"
            />
          );
        },
      }),

      columnHelper.accessor("name", {
        id: "name",
        header: t("Owner Name"),
        cell: ({ row }) => {
          const owner = row.original;
          return (
            <div>
              <div className="fw-semibold">{owner.name}</div>
              {owner.corporation_ticker && (
                <span className="text-muted small">[{owner.corporation_ticker}]</span>
              )}
            </div>
          );
        },
      }),

      columnHelper.accessor("is_corporation", {
        id: "is_corporation",
        header: t("Type"),
        cell: ({ row }) => {
          const owner = row.original;
          return owner.is_corporation ? (
            <span className="badge bg-info border border-info">
              {t("Corporation")}
            </span>
          ) : (
            <span className="badge bg-warning border border-warning">
              {t("Character")}
            </span>
          );
        },
      }),

      columnHelper.accessor("status", {
        id: "status",
        header: t("ESI Status"),
        cell: ({ row }) => {
          const owner = row.original;
          const badgeClass = `badge ${getEsiStatusBadgeClass(owner.status)}`;
          const hasDetails = Boolean(owner.error_message) || owner.status === "token_error";

          if (!hasDetails) {
            return <span className={badgeClass}>{owner.status}</span>;
          }

          // Badge opens the error modal (keyboard accessible)
          return (
            <span
              className={badgeClass}
              role="button"
              tabIndex={0}
              aria-label={t("Show error details for {{name}}", { name: owner.name })}
              onClick={() => setErrorOwner(owner)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setErrorOwner(owner);
                }
              }}
            >
              {owner.status}
            </span>
          );
        },
      }),

      columnHelper.accessor("is_public", {
        id: "is_public",
        header: t("Status"),
        cell: ({ row }) => {
          const owner = row.original;
          return (
            <span
              className={`badge ${owner.is_public ? "bg-success border border-success" : "bg-secondary border border-secondary"
                }`}
            >
              {owner.is_public ? t("Public") : t("Private")}
            </span>
          );
        },
      }),

      columnHelper.accessor("public_type", {
        id: "public_type",
        header: t("Offered Types"),
        cell: ({ row }) => {
          const owner = row.original;
          return (
            <span className="small text-muted text-uppercase">
              {owner.public_type || "all"}
            </span>
          );
        },
      }),

      columnHelper.accessor("selective_bpo_enabled", {
        id: "selective_bpo_enabled",
        header: t("Selective BPO"),
        cell: ({ row }) => {
          const owner = row.original;
          return owner.selective_bpo_enabled ? (
            <span className="badge bg-primary border border-primary">
              {t("Selective")}
            </span>
          ) : (
            <span className="text-muted small">{t("All BPOs")}</span>
          );
        },
      }),

      columnHelper.accessor((owner) => owner.blueprint_count ?? (owner.bpo_count + owner.bpc_count), {
        id: "blueprints",
        header: t("Blueprints"),
        cell: ({ row }) => {
          const owner = row.original;
          return renderTooltip(
            t("Inspect All Blueprints"),
            <Button
              variant="link"
              className="btn btn-link btn-sm p-0 text-decoration-none"
              onClick={() => onInspect(owner)}
            >
              <span className="text-primary fw-semibold">{owner.bpo_count} BPO</span> •{" "}
              <span>{owner.bpc_count} BPC</span>
            </Button>
          );
        },
      }),

      columnHelper.accessor(
        (owner) =>
          (owner.notify_order_created_group_ids?.length || 0) +
          (owner.notify_order_status_group_ids?.length || 0),
        {
          id: "assigned_groups",
          header: t("Assigned Groups"),
          cell: ({ row }) => {
            const owner = row.original;
            const createdCount = owner.notify_order_created_group_ids?.length || 0;
            const statusCount = owner.notify_order_status_group_ids?.length || 0;
            return createdCount + statusCount > 0 ? (
              <span className="badge bg-info-subtle text-info border border-info-subtle">
                {createdCount} new / {statusCount} status
              </span>
            ) : (
              <span className="text-muted">-</span>
            );
          },
        }
      ),

      columnHelper.display({
        id: "actions",
        header: () => <div className="text-end">{t("Actions")}</div>,
        enableSorting: false,
        cell: ({ row }) => {
          const owner = row.original;
          return (
            <div className="d-flex align-items-center justify-content-end gap-2">
              {renderTooltip(
                t("Inspect All Blueprints"),
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onInspect(owner)}
                  className="d-inline-flex align-items-center gap-1"
                >
                  <Eye size={13} />
                  <span>{t("Blueprints")}</span>
                </Button>
              )}
              {renderTooltip(
                t("Edit Owner Settings"),
                <Button
                  variant="warning"
                  size="sm"
                  onClick={() => onEdit(owner)}
                  className="d-inline-flex align-items-center gap-1"
                >
                  <Edit2 size={13} />
                  <span>{t("Edit")}</span>
                </Button>
              )}
              <Dropdown as={ButtonGroup} size="sm">
                {renderTooltip(
                  t("Trigger update_owner task (normal)"),
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onTriggerUpdate(owner.id, false)}
                    disabled={updatingOwnerId === owner.id}
                    className="d-inline-flex align-items-center gap-1"
                  >
                    {updatingOwnerId === owner.id ? (
                      <Spinner size="sm" animation="border" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                    <span>{t("Update")}</span>
                  </Button>
                )}
                {renderTooltip(
                  t("More update options"),
                  <Dropdown.Toggle
                    split
                    size="sm"
                    variant="danger"
                    aria-label={t("More update options")}
                    disabled={updatingOwnerId === owner.id}
                    
                  />
                )}
                <Dropdown.Menu
                  className={styles.dropdownMenu}
                  align="end"
                >
                  <Dropdown.Item onClick={() => onTriggerUpdate(owner.id, false)}>
                    <RefreshCw size={14} className="me-2 text-primary" />
                    {t("Normal Update")}
                  </Dropdown.Item>
                  {isSuperuser && (
                    <Dropdown.Item onClick={() => onTriggerUpdate(owner.id, true)}>
                      <RefreshCw size={14} className="me-2 text-warning" />
                      {t("Force Refresh (Bypass Cache)")}
                    </Dropdown.Item>
                  )}
                </Dropdown.Menu>
              </Dropdown>
              {renderTooltip(
                t("Delete Owner"),
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onDelete(owner)}
                  className="d-inline-flex align-items-center gap-1"
                >
                  <Trash2 size={13} />
                  <span>{t("Delete")}</span>
                </Button>
              )}
            </div>
          );
        },
      }),
    ];
  }, [t, updatingOwnerId, isSuperuser, onInspect, onEdit, onTriggerUpdate, onDelete]);

  return (
    <Card className="bg-secondary text-light border-0 shadow-sm">
      <Card.Header className="d-flex flex-wrap align-items-center justify-content-between gap-2 bg-transparent py-3">
        <div className="d-flex align-items-center gap-2">
          <Users size={18} className="text-primary" />
          <h2 className="h5 mb-0">{t("All Blueprint Owners")}</h2>
        </div>
      </Card.Header>
      <Card.Body>
        {taskFeedback && (
          <div className="p-3 pb-0">
            <Alert
              variant={taskFeedback.variant}
              dismissible
              onClose={onDismissFeedback}
              className="mb-0"
            >
              {taskFeedback.message}
            </Alert>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <Alert variant="danger">{t("Failed to load owners.")}</Alert>
          </div>
        ) : (
          <BaseTable
            data={owners ?? []}
            columns={columns}
            emptyText={t("No blueprint owners found in the system.")}
            initialState={{
              pagination: { pageSize: 25 },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel={t("owners")}
          />
        )}
      </Card.Body>
      <AdministrationErrorModal
        show={errorOwner !== null}
        onHide={() => setErrorOwner(null)}
        ownerName={errorOwner?.name ?? ""}
        status={errorOwner?.status ?? ""}
        errorMessage={errorOwner?.error_message}
      />
    </Card>
  );
};
