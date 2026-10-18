// React
import React, { useMemo, useState } from "react";

// Third Party
import { Layers, Search, ShoppingCart } from "lucide-react";
import { Badge, Button, ButtonGroup, Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import { BaseTable } from "@/Components/Base/BaseTable";
import { getBlueprintColumns } from "@/Components/Blueprint/BlueprintTableColumns";
import type { BlueprintItem } from "@/Components/Blueprint/BlueprintTableColumns";
import styles from "@/Styles/modules/Blueprint.module.css";

interface BlueprintTableProps {
  data: BlueprintItem[];
  isFetching?: boolean;
  selectedBlueprints?: Map<number, { blueprint: BlueprintItem; quantity: number; runs: number | null }>;
  onToggleSelect?: (blueprint: BlueprintItem) => void;
  showSelectColumn?: boolean;
  showLocationColumn?: boolean;
  typeFilter?: "all" | "bpo" | "bpc";
  onTypeFilterChange?: (filter: "all" | "bpo" | "bpc") => void;
  showOwnerFilter?: boolean;
  onOpenOrderModal?: () => void;
}

export const BlueprintTable: React.FC<BlueprintTableProps> = ({
  data,
  isFetching = false,
  selectedBlueprints,
  onToggleSelect,
  showSelectColumn = true,
  showLocationColumn = false,
  typeFilter: typeFilterProp,
  onTypeFilterChange,
  onOpenOrderModal,
}) => {
  const { t } = useTranslation();

  // Local filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [localTypeFilter, setLocalTypeFilter] = useState<"all" | "bpo" | "bpc">("all");
  const activeTypeFilter = typeFilterProp !== undefined ? typeFilterProp : localTypeFilter;

  const setTypeFilter = (filter: "all" | "bpo" | "bpc") => {
    if (onTypeFilterChange) {
      onTypeFilterChange(filter);
    }
    setLocalTypeFilter(filter);
  };

  const selectedIds = useMemo(() => {
    return new Set(selectedBlueprints ? Array.from(selectedBlueprints.keys()) : []);
  }, [selectedBlueprints]);

  const filteredData = useMemo(() => {
    return data.filter((bp) => {
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = bp.type_name.toLowerCase().includes(query);
        const matchesGroup = bp.group_name.toLowerCase().includes(query);
        const matchesLocation =
          showLocationColumn && bp.location_name
            ? bp.location_name.toLowerCase().includes(query)
            : false;
        if (!matchesName && !matchesGroup && !matchesLocation) {
          return false;
        }
      }

      // BPO vs BPC filter
      const isOriginal = Boolean(bp.is_original ?? (!bp.runs || bp.runs <= 0));
      if (activeTypeFilter === "bpo" && !isOriginal) return false;
      if (activeTypeFilter === "bpc" && isOriginal) return false;

      return true;
    });
  }, [data, searchTerm, activeTypeFilter, showLocationColumn]);

  const columns = useMemo(() => {
    return getBlueprintColumns({
      t,
      selectedIds,
      onToggleSelect,
      showSelectColumn,
      showLocationColumn,
    });
  }, [t, selectedIds, onToggleSelect, showSelectColumn, showLocationColumn]);

  return (
    <div className="d-flex flex-column gap-3">
      {/* Table Filter Controls */}
      <div className="bg-dark p-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
        {/* Search Input */}
        <div className={`flex-grow-1 ${styles.searchWrapper}`}>
          <div className="input-group">
            <span className="input-group-text">
              <Search size={16} />
            </span>
            <Form.Control
              type="text"
              placeholder={
                showLocationColumn
                  ? t("Search by blueprint, group, or location...")
                  : t("Search by blueprint or group...")
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="d-flex flex-wrap align-items-center gap-3">
          {/* BPO / BPC Switch */}
          <div className="d-flex align-items-center gap-2">
            <span className="text-light small d-flex align-items-center gap-1">
              <Layers size={14} />
              {t("Type:")}
            </span>
            <ButtonGroup size="sm">
              <Button
                variant={activeTypeFilter === "all" ? "primary" : "outline-secondary"}
                onClick={() => setTypeFilter("all")}
                className={activeTypeFilter === "all" ? "aa-btn aa-btn-primary text-light" : "aa-btn aa-btn-secondary"}
              >
                {t("All")}
              </Button>
              <Button
                variant={activeTypeFilter === "bpo" ? "primary" : "outline-secondary"}
                onClick={() => setTypeFilter("bpo")}
                className={activeTypeFilter === "bpo" ? "aa-btn aa-btn-primary text-light" : "aa-btn aa-btn-secondary"}
              >
                {t("BPO (Original)")}
              </Button>
              <Button
                variant={activeTypeFilter === "bpc" ? "info" : "outline-secondary"}
                onClick={() => setTypeFilter("bpc")}
                className={activeTypeFilter === "bpc" ? "aa-btn aa-btn-info text-light" : "aa-btn aa-btn-secondary"}
              >
                {t("BPC (Copy)")}
              </Button>
            </ButtonGroup>
          </div>

          {/* Review Order Button next to Type filter when selection exists */}
          {selectedBlueprints && selectedBlueprints.size > 0 && onOpenOrderModal && (
            <Button
              size="sm"
              onClick={onOpenOrderModal}
              className="d-flex align-items-center gap-2 aa-btn aa-btn-primary"
              data-testid="top-review-order-btn"
            >
              <ShoppingCart size={15} />
              <span>{t("Review Order")}</span>
              <Badge pill bg="light" text="dark" className="ms-1">
                {selectedBlueprints.size}
              </Badge>
            </Button>
          )}
        </div>
      </div>

      {/* Main BaseTable */}
      <BaseTable
        data={filteredData}
        columns={columns}
        isFetching={isFetching}
        emptyText={t("No blueprints found matching filters.")}
        initialState={{
          pagination: { pageSize: 25 },
        }}
        pageSizeOptions={[15, 25, 50, 100]}
        itemLabel={t("blueprints")}
      />
    </div>
  );
};
