// React
import React, { useMemo, useState } from "react";

// Third Party
import { Layers, Search } from "lucide-react";
import { Button, Form, ButtonGroup } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import { BaseTable } from "@/Components/Base/BaseTable";
import { getBlueprintColumns } from "@/Components/Catalog/BlueprintTableColumns";
import type { BlueprintItem } from "@/Components/Catalog/BlueprintTableColumns";
import styles from "@/Styles/modules/Catalog.module.css";

interface BlueprintTableProps {
  data: BlueprintItem[];
  isFetching?: boolean;
  selectedBlueprints?: Map<number, { blueprint: BlueprintItem; quantity: number; runs: number | null }>;
  onToggleSelect?: (blueprint: BlueprintItem) => void;
  showSelectColumn?: boolean;
  typeFilter?: "all" | "bpo" | "bpc";
  onTypeFilterChange?: (filter: "all" | "bpo" | "bpc") => void;
  showOwnerFilter?: boolean;
}

export const BlueprintTable: React.FC<BlueprintTableProps> = ({
  data,
  isFetching = false,
  selectedBlueprints,
  onToggleSelect,
  showSelectColumn = true,
  typeFilter: typeFilterProp,
  onTypeFilterChange,
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
        const matchesLocation = bp.location_name.toLowerCase().includes(query);
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
  }, [data, searchTerm, activeTypeFilter]);

  const columns = useMemo(() => {
    return getBlueprintColumns({
      t,
      selectedIds,
      onToggleSelect,
      showSelectColumn,
    });
  }, [t, selectedIds, onToggleSelect, showSelectColumn]);

  return (
    <div className="d-flex flex-column gap-3">
      {/* Table Filter Controls */}
      <div className="aa-panel p-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
        {/* Search Input */}
        <div className={`flex-grow-1 ${styles.searchWrapper}`}>
          <div className="input-group">
            <span className="input-group-text bg-dark border-secondary text-secondary">
              <Search size={16} />
            </span>
            <Form.Control
              type="text"
              placeholder={t("Search by blueprint or group...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-dark text-light border-secondary"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="d-flex flex-wrap align-items-center gap-3">
          {/* BPO / BPC Switch */}
          <div className="d-flex align-items-center gap-2">
            <span className="text-secondary small d-flex align-items-center gap-1">
              <Layers size={14} />
              {t("Type:")}
            </span>
            <ButtonGroup size="sm">
              <Button
                variant={activeTypeFilter === "all" ? "primary" : "outline-secondary"}
                onClick={() => setTypeFilter("all")}
                className={activeTypeFilter === "all" ? "aa-btn aa-btn-primary fw-semibold" : "aa-btn aa-btn-secondary"}
              >
                {t("All")}
              </Button>
              <Button
                variant={activeTypeFilter === "bpo" ? "primary" : "outline-secondary"}
                onClick={() => setTypeFilter("bpo")}
                className={activeTypeFilter === "bpo" ? "aa-btn aa-bg-primary text-light fw-semibold" : "aa-btn aa-btn-secondary"}
              >
                {t("BPO (Original)")}
              </Button>
              <Button
                variant={activeTypeFilter === "bpc" ? "info" : "outline-secondary"}
                onClick={() => setTypeFilter("bpc")}
                className={activeTypeFilter === "bpc" ? "aa-btn aa-bg-primary-light text-light fw-semibold" : "aa-btn aa-btn-secondary"}
              >
                {t("BPC (Copy)")}
              </Button>
            </ButtonGroup>
          </div>
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
