// React
import React, { useState } from "react";

// Third Party
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Alert, Badge, Button, ButtonGroup, Dropdown, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { BlueprintItemSchema, OwnerSettingSchema } from "@/Api/schema";
import { BlueprintTable } from "@/Components/Catalog/BlueprintTable";
import styles from "@/Styles/modules/Superuser.module.css";
import { renderTooltip } from "@/Utils";
import { imageServer } from "@/Utils/eveOnline";

interface SuperuserInspectionViewProps {
  inspectingOwner: OwnerSettingSchema;
  ownerBlueprints: BlueprintItemSchema[];
  isLoading: boolean;
  isError: boolean;
  updatingOwnerId: number | null;
  taskFeedback: { variant: "success" | "danger"; message: string } | null;
  onDismissFeedback: () => void;
  onBack: () => void;
  onRefetch: () => void;
  onTriggerUpdate: (ownerId: number, forceRefresh: boolean) => void;
}

export const SuperuserInspectionView: React.FC<SuperuserInspectionViewProps> = ({
  inspectingOwner,
  ownerBlueprints,
  isLoading,
  isError,
  updatingOwnerId,
  taskFeedback,
  onDismissFeedback,
  onBack,
  onRefetch,
  onTriggerUpdate,
}) => {
  const { t } = useTranslation();
  const [inspectionTypeFilter, setInspectionTypeFilter] = useState<"all" | "bpo" | "bpc">("all");

  const bpoCount = ownerBlueprints.filter((b) => b.is_original).length;
  const bpcCount = ownerBlueprints.filter((b) => !b.is_original).length;
  const avatarUrl =
    inspectingOwner.portrait_url ||
    (inspectingOwner.is_corporation && inspectingOwner.corporation_id
      ? imageServer("corporations", inspectingOwner.corporation_id, 32)
      : inspectingOwner.character_id
        ? imageServer("characters", inspectingOwner.character_id, 32)
        : null);

  return (
    <main className="aa-panel">
      <header className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-3">
          <Button
            size="sm"
            onClick={onBack}
            className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
          >
            <ArrowLeft size={16} />
            <span>{t("Back to Superuser Overview")}</span>
          </Button>
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt=""
              width={36}
              height={36}
              className="rounded"
            />
          )}
          <div>
            <div className="d-flex align-items-center gap-2">
              <h1 className="h4 mb-0 text-light fw-bold">{inspectingOwner.name}</h1>
              <Badge bg="warning" text="dark">
                {t("Superuser Inspection")}
              </Badge>
              {inspectingOwner.is_public ? (
                <Badge bg="success">{t("Public Shop")}</Badge>
              ) : (
                <Badge bg="secondary">{t("Private Shop")}</Badge>
              )}
            </div>
            <p className="text-secondary small mb-0">
              {t(
                "All raw blueprints owned by this character or corporation, identical to their personal view."
              )}
            </p>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Dropdown as={ButtonGroup} size="sm">
            {renderTooltip(
              t("Trigger background update_owner task (normal)"),
              <Button
                size="sm"
                onClick={() => onTriggerUpdate(inspectingOwner.id, false)}
                disabled={updatingOwnerId === inspectingOwner.id}
                className="d-flex align-items-center gap-1 aa-btn aa-btn-warning"
              >
                {updatingOwnerId === inspectingOwner.id ? (
                  <Spinner size="sm" animation="border" />
                ) : (
                  <RefreshCw size={14} />
                )}
                <span>{t("Run Update Task")}</span>
              </Button>
            )}
            {renderTooltip(
              t("More update options"),
              <Dropdown.Toggle
                split
                size="sm"
                aria-label={t("More update options")}
                disabled={updatingOwnerId === inspectingOwner.id}
                className="aa-btn aa-btn-warning"
              />
            )}
            <Dropdown.Menu
              className={`dropdown-menu-dark ${styles.dropdownMenu}`}
              align="end"
            >
              <Dropdown.Item onClick={() => onTriggerUpdate(inspectingOwner.id, false)}>
                <RefreshCw size={14} className="me-2 text-primary" />
                {t("Normal Update")}
              </Dropdown.Item>
              <Dropdown.Item onClick={() => onTriggerUpdate(inspectingOwner.id, true)}>
                <RefreshCw size={14} className="me-2 text-warning" />
                {t("Force Refresh (Bypass Cache)")}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Button
            size="sm"
            onClick={onRefetch}
            className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
          >
            <RefreshCw size={14} />
            <span>{t("Refresh")}</span>
          </Button>
        </div>
      </header>

      {taskFeedback && (
        <Alert
          variant={taskFeedback.variant}
          dismissible
          onClose={onDismissFeedback}
          className="mb-3"
        >
          {taskFeedback.message}
        </Alert>
      )}

      {/* Summary KPI Panel identical to MyBlueprintsPage */}
      <section className="aa-panel p-3 d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h4 className="text-light mb-1 fw-bold">{t("Owner Blueprint Inventory")}</h4>
          <p className="text-secondary small mb-0">
            {t("Unfiltered inventory across all locations and containers.")}
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          {renderTooltip(
            t("Show all blueprints"),
            <div
              className={`px-3 py-2 rounded border text-center ${styles.kpiCard} ${inspectionTypeFilter === "all" ? "bg-primary border-primary shadow" : "bg-dark border-secondary"}`}
              role="button"
              tabIndex={0}
              onClick={() => setInspectionTypeFilter("all")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setInspectionTypeFilter("all");
              }}
            >
              <span className="text-light small d-block">{t("Total Blueprints")}</span>
              <span className="fw-bold fs-5 text-light">{ownerBlueprints.length}</span>
            </div>
          )}
          {renderTooltip(
            t("Filter to show only Originals (BPO)"),
            <div
              className={`px-3 py-2 rounded border text-center ${styles.kpiCard} ${inspectionTypeFilter === "bpo" ? "bg-primary border-primary shadow" : "bg-dark border-primary-subtle"}`}
              role="button"
              tabIndex={0}
              onClick={() =>
                setInspectionTypeFilter(inspectionTypeFilter === "bpo" ? "all" : "bpo")
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  setInspectionTypeFilter(inspectionTypeFilter === "bpo" ? "all" : "bpo");
              }}
            >
              <span className="text-light small d-block">{t("Originals (BPO)")}</span>
              <span className="fw-bold fs-5 text-primary">{bpoCount}</span>
            </div>
          )}
          {renderTooltip(
            t("Filter to show only Copies (BPC)"),
            <div
              className={`px-3 py-2 rounded border text-center ${styles.kpiCard} ${inspectionTypeFilter === "bpc" ? "bg-info text-dark border-info shadow" : "bg-dark border-info-subtle"}`}
              role="button"
              tabIndex={0}
              onClick={() =>
                setInspectionTypeFilter(inspectionTypeFilter === "bpc" ? "all" : "bpc")
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  setInspectionTypeFilter(inspectionTypeFilter === "bpc" ? "all" : "bpc");
              }}
            >
              <span className="small d-block">{t("Copies (BPC)")}</span>
              <span className="fw-bold fs-5">{bpcCount}</span>
            </div>
          )}
        </div>
      </section>

      {isLoading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div className="text-secondary mt-2">{t("Loading owner blueprints...")}</div>
        </div>
      )}

      {isError && (
        <Alert variant="danger" className="d-flex align-items-center gap-2">
          <span>{t("Failed to load owner blueprints.")}</span>
        </Alert>
      )}

      {!isLoading && !isError && (
        <BlueprintTable
          data={ownerBlueprints}
          isFetching={isLoading}
          showSelectColumn={false}
          typeFilter={inspectionTypeFilter}
          onTypeFilterChange={setInspectionTypeFilter}
        />
      )}
    </main>
  );
};
