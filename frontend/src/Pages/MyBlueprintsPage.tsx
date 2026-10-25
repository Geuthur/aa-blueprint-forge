// React
import { useState } from "react";

// Third Party
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, Button, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import { loadMyBlueprints } from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import BaseSectionHeader from "@/Components/Base/BaseHeader";
import { BlueprintTable } from "@/Components/BlueprintTable/BlueprintTable";
import { MyBlueprintsKpiSection } from "@/Components/MyBlueprints/MyBlueprintsKpiSection";

export function MyBlueprintsPage() {
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter] = useState<"all" | "bpo" | "bpc">("all");

  const {
    data: blueprints = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.MyBlueprints,
    queryFn: loadMyBlueprints,
  });

  const bpoCount = blueprints.filter((b) => b.is_original).length;
  const bpcCount = blueprints.filter((b) => !b.is_original).length;

  return (
    <main className="d-flex flex-column gap-3">
      <BaseSectionHeader name={t("My Blueprints")}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
        >
          <RefreshCw size={14} />
          <span>{t("Refresh")}</span>
        </Button>
      </BaseSectionHeader>

      {/* Summary KPI Panel */}
      <MyBlueprintsKpiSection
        totalCount={blueprints.length}
        bpoCount={bpoCount}
        bpcCount={bpcCount}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />

      {isLoading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div className="text-light mt-2">{t("Loading your blueprints…")}</div>
        </div>
      )}

      {isError && (
        <Alert variant="danger" className="d-flex align-items-center gap-2">
          <AlertCircle size={18} />
          <span>{t("Failed to load your blueprints. Please try again.")}</span>
        </Alert>
      )}

      {!isLoading && !isError && (
        <BlueprintTable
          data={blueprints}
          isFetching={isLoading}
          showSelectColumn={false}
          showLocationColumn={true}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
        />
      )}
    </main>
  );
}

export default MyBlueprintsPage;
