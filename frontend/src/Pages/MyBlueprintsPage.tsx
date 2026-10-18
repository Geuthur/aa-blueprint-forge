// React
import { useState } from "react";

// Third Party
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Button, Spinner, Alert } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import { loadMyBlueprints } from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import BaseSectionHeader from "@/Components/Base/BaseHeader";
import { BlueprintTable } from "@/Components/Blueprint/BlueprintTable";
import styles from "@/Styles/modules/Blueprint.module.css";
import { renderTooltip } from "@/Utils";

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
      <section className="aa-panel p-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h4 className="text-light mb-1 fw-bold">{t("Personal & Corporation Blueprints")}</h4>
          <p className="text-secondary small mb-0">
            {t("Overview of all blueprints owned by your linked characters and corporations.")}
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          {renderTooltip(
            t("Show all blueprints"),
            <div
              aria-label={t("Show all blueprints")}
              className={`px-3 py-2 rounded text-center bg-secondary text-light border ${styles.kpiFilterCard} ${typeFilter === "all" ? "border-2 border-light shadow" : "border-secondary opacity-75"
                }`}
              role="button"
              tabIndex={0}
              onClick={() => setTypeFilter("all")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setTypeFilter("all");
              }}
            >
              <span className="small d-block opacity-75">{t("Total Blueprints")}</span>
              <span className="fw-bold fs-5">{blueprints.length}</span>
            </div>
          )}
          {renderTooltip(
            t("Filter to show only Originals (BPO)"),
            <div
              aria-label={t("Filter to show only Originals (BPO)")}
              className={`px-3 py-2 rounded text-center bg-primary text-light border ${styles.kpiFilterCard} ${typeFilter === "bpo" ? "border-2 border-light shadow" : "border-primary opacity-75"
                }`}
              role="button"
              tabIndex={0}
              onClick={() => setTypeFilter(typeFilter === "bpo" ? "all" : "bpo")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setTypeFilter(typeFilter === "bpo" ? "all" : "bpo");
              }}
            >
              <span className="small d-block opacity-75">{t("Originals (BPO)")}</span>
              <span className="fw-bold fs-5">{bpoCount}</span>
            </div>
          )}
          {renderTooltip(
            t("Filter to show only Copies (BPC)"),
            <div
              aria-label={t("Filter to show only Copies (BPC)")}
              className={`px-3 py-2 rounded text-center bg-info text-dark border ${styles.kpiFilterCard} ${typeFilter === "bpc" ? "border-2 border-light shadow" : "border-info opacity-75"
                }`}
              role="button"
              tabIndex={0}
              onClick={() => setTypeFilter(typeFilter === "bpc" ? "all" : "bpc")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setTypeFilter(typeFilter === "bpc" ? "all" : "bpc");
              }}
            >
              <span className="small d-block opacity-75">{t("Copies (BPC)")}</span>
              <span className="fw-bold fs-5">{bpcCount}</span>
            </div>
          )}
        </div>
      </section>

      {isLoading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div className="text-secondary mt-2">{t("Loading your blueprints...")}</div>
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
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
        />
      )}
    </main>
  );
}

export default MyBlueprintsPage;
