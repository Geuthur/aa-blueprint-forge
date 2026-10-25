// React
import React from "react";

// Third Party
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Alert, Badge, Button, Card } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { components } from "@/Api/OpenApi";
import { OwnerPortrait } from "@/Components/Base/OwnerPortrait";
import { BlueprintTable } from "@/Components/BlueprintTable/BlueprintTable";
import type { BlueprintItem } from "@/Components/BlueprintTable/BlueprintTableColumns";
import { OrderFloatingBar } from "@/Components/Main/OrderFloatingBar";
import { OrderModal } from "@/Components/Main/OrderModal";
import type { CartItem } from "@/Components/Main/OrderModal";
import { renderTooltip } from "@/Utils";
import { imageServer } from "@/Utils/eveOnline";

type PublicOwner = components["schemas"]["OwnerPublicSchema"];

interface CatalogDetailSectionProps {
  selectedOwner: PublicOwner | undefined;
  blueprints: BlueprintItem[];
  isBlueprintsLoading: boolean;
  catalogTypeFilter: "all" | "bpo" | "bpc";
  onCatalogTypeFilterChange: (filter: "all" | "bpo" | "bpc") => void;
  cart: Map<number, CartItem>;
  onToggleSelect: (blueprint: BlueprintItem) => void;
  onUpdateQuantity: (blueprintId: number, quantity: number) => void;
  onUpdateRuns: (blueprintId: number, runs: number | null) => void;
  onRemoveItem: (blueprintId: number) => void;
  onClearCart: () => void;
  showOrderModal: boolean;
  onOpenOrderModal: () => void;
  onCloseOrderModal: () => void;
  onSubmitOrder: (note: string) => Promise<void>;
  isSubmittingOrder: boolean;
  onBackToDirectory: () => void;
  onRefetchBlueprints: () => void;
}

export const CatalogDetailSection: React.FC<CatalogDetailSectionProps> = ({
  selectedOwner,
  blueprints,
  isBlueprintsLoading,
  catalogTypeFilter,
  onCatalogTypeFilterChange,
  cart,
  onToggleSelect,
  onUpdateQuantity,
  onUpdateRuns,
  onRemoveItem,
  onClearCart,
  showOrderModal,
  onOpenOrderModal,
  onCloseOrderModal,
  onSubmitOrder,
  isSubmittingOrder,
  onBackToDirectory,
  onRefetchBlueprints,
}) => {
  const { t } = useTranslation();

  return (
    <section className="d-flex flex-column gap-3">
      {/* Selected Provider Header Banner */}
      {selectedOwner && (
        <Card className="bg-dark text-light border-0 shadow-sm">
          <Card.Body className="p-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={onBackToDirectory}
                className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
                title={t("Back to all catalogs")}
              >
                <ArrowLeft size={16} />
                <span className="d-none d-sm-inline">{t("All Catalogs")}</span>
              </Button>
              <OwnerPortrait
                src={
                  selectedOwner.character_id
                    ? imageServer("characters", selectedOwner.character_id, 64)
                    : selectedOwner.corporation_id
                      ? imageServer("corporations", selectedOwner.corporation_id, 64)
                      : null
                }
                alt={selectedOwner.name}
                type={selectedOwner.character_id ? "character" : "corporation"}
                size="md"
                shape="rounded"
              />
              <div>
                <div className="d-flex align-items-center gap-2">
                  <h4 className="mb-0 fw-bold">{selectedOwner.name}</h4>
                  <Badge bg={selectedOwner.is_corporation ? "info" : "secondary"}>
                    {selectedOwner.is_corporation ? t("Corporation") : t("Personal")}
                  </Badge>
                </div>
                <p className="text-light small mb-0 mt-1">
                  {t(
                    "Select blueprints to add them to your order. You can review quantities and copy runs before submitting."
                  )}
                </p>
              </div>
            </div>

            <div>
              {renderTooltip(
                t("Refresh catalog blueprints"),
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRefetchBlueprints}
                  className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
                >
                  <RefreshCw size={14} />
                  <span className="d-none d-sm-inline">{t("Refresh")}</span>
                </Button>
              )}
            </div>
          </Card.Body>
        </Card>
      )}

      {!selectedOwner ? (
        <Alert variant="warning" className="d-flex align-items-center justify-content-between">
          <span>{t("Selected catalog was not found or is no longer public.")}</span>
          <Button variant="outline-warning" size="sm" onClick={onBackToDirectory}>
            {t("Return to Overview")}
          </Button>
        </Alert>
      ) : (
        <>
          <BlueprintTable
            data={blueprints}
            isFetching={isBlueprintsLoading}
            selectedBlueprints={cart}
            onToggleSelect={onToggleSelect}
            showSelectColumn={true}
            typeFilter={catalogTypeFilter}
            onTypeFilterChange={onCatalogTypeFilterChange}
            onOpenOrderModal={onOpenOrderModal}
          />

          {/* Floating Cart Bar */}
          <OrderFloatingBar
            itemCount={cart.size}
            onOpenOrderModal={onOpenOrderModal}
            onClearCart={onClearCart}
          />

          {/* Order Modal */}
          <OrderModal
            show={showOrderModal}
            onHide={onCloseOrderModal}
            shopName={selectedOwner?.name ?? t("Blueprint Catalog")}
            items={Array.from(cart.values())}
            onUpdateQuantity={onUpdateQuantity}
            onUpdateRuns={onUpdateRuns}
            onRemoveItem={onRemoveItem}
            onSubmitOrder={onSubmitOrder}
            isSubmitting={isSubmittingOrder}
          />
        </>
      )}
    </section>
  );
};
