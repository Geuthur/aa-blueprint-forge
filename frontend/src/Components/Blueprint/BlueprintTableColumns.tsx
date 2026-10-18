// Third Party
import { createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { Plus, Check } from "lucide-react";
import { Badge, Button } from "react-bootstrap";

// AA bpforge
import type { components } from "@/Api/OpenApi";
import styles from "@/Styles/modules/Blueprint.module.css";
import { renderTooltip } from "@/Utils";
import { imageServer } from "@/Utils/eveOnline";

export type BlueprintItem = components["schemas"]["BlueprintItemSchema"];

export interface BlueprintTableColumnsOptions {
  t: TFunction;
  selectedIds?: Set<number>;
  onToggleSelect?: (blueprint: BlueprintItem) => void;
  showSelectColumn?: boolean;
}

export function getBlueprintColumns({
  t,
  selectedIds,
  onToggleSelect,
  showSelectColumn = true,
}: BlueprintTableColumnsOptions): ColumnDef<BlueprintItem, unknown>[] {
  const columnHelper = createColumnHelper<BlueprintItem>();

  const columns: ColumnDef<BlueprintItem, unknown>[] = [];

  columns.push(
    columnHelper.accessor("type_name", {
      id: "type_name",
      header: t("Blueprint"),
      cell: ({ row }) => {
        const bp = row.original;
        return (
          <div className="d-flex align-items-center gap-2">
            <img
              src={imageServer(bp.is_original ? "bpo" : "bpc", bp.type_id, 32)}
              alt={bp.type_name}
              width={28}
              height={28}
              className="rounded"
              loading="lazy"
            />
            <div>
              <span className="text-light">{bp.type_name}</span>
              {bp.group_name && (
                <div className="text-secondary small">{bp.group_name}</div>
              )}
            </div>
          </div>
        );
      },
    }),

    columnHelper.accessor("is_original", {
      id: "is_original",
      header: t("Type"),
      cell: ({ getValue }) => {
        const isBpo = Boolean(getValue());
        return isBpo ? (
          <Badge bg="primary" className="aa-bg-primary border border-primary">
            {t("Original (BPO)")}
          </Badge>
        ) : (
          <Badge bg="info" className="aa-bg-primary-light border border-info">
            {t("Copy (BPC)")}
          </Badge>
        );
      },
    }),

    columnHelper.accessor("runs", {
      id: "runs",
      header: t("Runs"),
      cell: ({ row }) => {
        const bp = row.original;
        if (bp.is_original) {
          return <span className="text-secondary">∞ ({t("Unlimited")})</span>;
        }
        return <span className="text-info">{bp.runs ?? 1}</span>;
      },
    }),

    columnHelper.accessor("material_efficiency", {
      id: "material_efficiency",
      header: t("ME"),
      cell: ({ getValue }) => {
        const val = getValue();
        return val !== null && val !== undefined ? (
          <span className="text-success fw-bold">ME {Number(val)}</span>
        ) : (
          <span className="text-secondary">-</span>
        );
      },
    }),

    columnHelper.accessor("time_efficiency", {
      id: "time_efficiency",
      header: t("TE"),
      cell: ({ getValue }) => {
        const val = getValue();
        return val !== null && val !== undefined ? (
          <span className="text-warning fw-bold">TE {Number(val)}</span>
        ) : (
          <span className="text-secondary">-</span>
        );
      },
    }),

    columnHelper.accessor("quantity", {
      id: "quantity",
      header: t("Quantity"),
      cell: ({ getValue }) => (
        <span className="fw-semibold">{Number(getValue() ?? 1)}</span>
      ),
    }),

    columnHelper.accessor("location_name", {
      id: "location_name",
      header: t("Location"),
      cell: ({ getValue }) => {
        const text = String(getValue() || t("Unknown"));
        return renderTooltip(
          text,
          <span className={`text-secondary small text-truncate d-inline-block ${styles.locationCell}`}>
            {text}
          </span>
        );
      },
    })
  );

  if (showSelectColumn && onToggleSelect) {
    columns.push(
      columnHelper.display({
        id: "select",
        header: () => <div className="text-end text-secondary">{t("Order")}</div>,
        cell: ({ row }) => {
          const bp = row.original;
          const isSelected = selectedIds?.has(bp.item_id);

          return (
            <div className="d-flex justify-content-end">
              {renderTooltip(
                isSelected ? t("In order cart") : t("Add to order"),
                <Button
                  variant={`${isSelected ? "success" : "primary"}`}
                  size="sm"
                  className={`py-1 px-2 d-flex align-items-center gap-1 ${isSelected ? "aa-btn-success aa-btn" : "aa-btn aa-btn-primary"}`}
                  onClick={() => onToggleSelect(bp)}
                >
                  {isSelected ? <Check size={14} /> : <Plus size={14} />}
                  <span className="small">{isSelected ? t("Added") : t("Select")}</span>
                </Button>
              )}
            </div>
          );
        },
      }) as ColumnDef<BlueprintItem, unknown>
    );
  }

  return columns;
}
