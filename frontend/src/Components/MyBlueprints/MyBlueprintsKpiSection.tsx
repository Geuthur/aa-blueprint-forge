// React
import React from "react";

// Third Party
import { Card } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import styles from "@/Styles/modules/Blueprint.module.css";
import { renderTooltip } from "@/Utils";

interface MyBlueprintsKpiSectionProps {
  totalCount: number;
  bpoCount: number;
  bpcCount: number;
  typeFilter: "all" | "bpo" | "bpc";
  onTypeFilterChange: (filter: "all" | "bpo" | "bpc") => void;
}

export const MyBlueprintsKpiSection: React.FC<MyBlueprintsKpiSectionProps> = ({
  totalCount,
  bpoCount,
  bpcCount,
  typeFilter,
  onTypeFilterChange,
}) => {
  const { t } = useTranslation();

  return (
    <Card className="bg-secondary text-light border-0 shadow-sm">
      <Card.Body className="p-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
      <div>
        <h4 className="mb-1 fw-bold">{t("Personal & Corporation Blueprints")}</h4>
        <p className="text-light small mb-0">
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
            onClick={() => onTypeFilterChange("all")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onTypeFilterChange("all");
            }}
          >
            <span className="small d-block opacity-75">{t("Total Blueprints")}</span>
            <span className="fw-bold fs-5">{totalCount}</span>
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
            onClick={() => onTypeFilterChange(typeFilter === "bpo" ? "all" : "bpo")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                onTypeFilterChange(typeFilter === "bpo" ? "all" : "bpo");
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
            className={`px-3 py-2 rounded text-center bg-info border ${styles.kpiFilterCard} ${typeFilter === "bpc" ? "border-2 border-light shadow" : "border-info opacity-75"
              }`}
            role="button"
            tabIndex={0}
            onClick={() => onTypeFilterChange(typeFilter === "bpc" ? "all" : "bpc")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                onTypeFilterChange(typeFilter === "bpc" ? "all" : "bpc");
            }}
          >
            <span className="small d-block opacity-75">{t("Copies (BPC)")}</span>
            <span className="fw-bold fs-5">{bpcCount}</span>
          </div>
        )}
      </div>
      </Card.Body>
    </Card>
  );
};
