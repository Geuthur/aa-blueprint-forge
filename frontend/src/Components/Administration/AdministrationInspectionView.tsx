// React
import React, { useState } from "react";

// Third Party
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Alert, Badge, Button, ButtonGroup, Card, Dropdown, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { BlueprintItemSchema, OwnerSettingSchema } from "@/Api/schema";
import { OwnerPortrait } from "@/Components/Base/OwnerPortrait";
import { BlueprintTable } from "@/Components/BlueprintTable/BlueprintTable";
import styles from "@/Styles/modules/Administration.module.css";
import { renderTooltip } from "@/Utils";
import { imageServer } from "@/Utils/eveOnline";

interface AdministrationInspectionViewProps {
  inspectingOwner: OwnerSettingSchema;
  ownerBlueprints: BlueprintItemSchema[];
  isLoading: boolean;
  isError: boolean;
  updatingOwnerId: number | null;
  taskFeedback: { variant: "success" | "danger"; message: string } | null;
  onDismissFeedback: () => void;
  onBack: () => void;
  onRefetch: () => void;
  isSuperuser: boolean;
  onTriggerUpdate: (ownerId: number, forceRefresh: boolean) => void;
}

export const AdministrationInspectionView: React.FC<AdministrationInspectionViewProps> = ({
  inspectingOwner,
  ownerBlueprints,
  isLoading,
  isError,
  updatingOwnerId,
  taskFeedback,
  onDismissFeedback,
  onBack,
  onRefetch,
  isSuperuser,
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
    <Card>
      <Card.Body className="bg-secondary">
        <Card.Header className="d-flex align-items-center justify-content-between mb-4 bg-dark">
          <div className="d-flex align-items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={onBack}
              className="d-flex align-items-center gap-1"
            >
              <ArrowLeft size={16} />
              <span>{t("Back to Administration Overview")}</span>
            </Button>
            <OwnerPortrait
              src={avatarUrl}
              type={inspectingOwner.is_corporation ? "corporation" : "character"}
              size="sm"
              shape="rounded"
            />
            <div>
              <div className="d-flex align-items-center gap-2">
                <h1 className="h4 mb-0 fw-bold">{inspectingOwner.name}</h1>
                <Badge bg="warning" text="dark">
                  {t("Administration Inspection")}
                </Badge>
                {inspectingOwner.is_public ? (
                  <Badge bg="success">{t("Public Shop")}</Badge>
                ) : (
                  <Badge bg="secondary">{t("Private Shop")}</Badge>
                )}
              </div>
              <p className="text-light small mb-0">
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
                  variant="warning"
                  size="sm"
                  onClick={() => onTriggerUpdate(inspectingOwner.id, false)}
                  disabled={updatingOwnerId === inspectingOwner.id}
                  className="d-flex align-items-center gap-1"
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
                  variant="warning"
                  split
                  size="sm"
                  aria-label={t("More update options")}
                  disabled={updatingOwnerId === inspectingOwner.id}
                  
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
                {isSuperuser && (
                  <Dropdown.Item onClick={() => onTriggerUpdate(inspectingOwner.id, true)}>
                    <RefreshCw size={14} className="me-2 text-warning" />
                    {t("Force Refresh (Bypass Cache)")}
                  </Dropdown.Item>
                )}
              </Dropdown.Menu>
            </Dropdown>
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefetch}
              className="d-flex align-items-center gap-1"
            >
              <RefreshCw size={14} />
              <span>{t("Refresh")}</span>
            </Button>
          </div>
        </Card.Header>

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
        <Card.Body className="bg-dark p-3 d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div>
            <h4 className="mb-1 fw-bold">{t("Owner Blueprint Inventory")}</h4>
            <p className="text-light small mb-0">
              {t("Unfiltered inventory across all locations and containers.")}
            </p>
          </div>

          <div className="d-flex align-items-center gap-3">
            {renderTooltip(
              t("Show all blueprints"),
              <div
                className={`px-3 py-2 rounded text-center bg-secondary text-light border ${styles.kpiCard} ${inspectionTypeFilter === "all" ? "border-2 border-light shadow" : "border-dark opacity-75"
                  }`}
                role="button"
                tabIndex={0}
                onClick={() => setInspectionTypeFilter("all")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setInspectionTypeFilter("all");
                }}
              >
                <span className="small d-block opacity-75">{t("Total Blueprints")}</span>
                <span className="fw-bold fs-5">{ownerBlueprints.length}</span>
              </div>
            )}
            {renderTooltip(
              t("Filter to show only Originals (BPO)"),
              <div
                className={`px-3 py-2 rounded text-center bg-primary text-light border ${styles.kpiCard} ${inspectionTypeFilter === "bpo" ? "border-2 border-light shadow" : "border-primary opacity-75"
                  }`}
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
                <span className="small d-block opacity-75">{t("Originals (BPO)")}</span>
                <span className="fw-bold fs-5">{bpoCount}</span>
              </div>
            )}
            {renderTooltip(
              t("Filter to show only Copies (BPC)"),
              <div
                className={`px-3 py-2 rounded text-center bg-info border ${styles.kpiCard} ${inspectionTypeFilter === "bpc" ? "border-2 border-light shadow" : "border-info opacity-75"
                  }`}
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
                <span className="small d-block opacity-75">{t("Copies (BPC)")}</span>
                <span className="fw-bold fs-5">{bpcCount}</span>
              </div>
            )}
          </div>
        </Card.Body>

        {isLoading && (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <div className="text-light mt-2">{t("Loading owner blueprints…")}</div>
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
            showLocationColumn={true}
            typeFilter={inspectionTypeFilter}
            onTypeFilterChange={setInspectionTypeFilter}
          />
        )}
      </Card.Body>
    </Card>
  );
};
