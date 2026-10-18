// React
import { useState } from "react";

// Third Party
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Store, AlertCircle, RefreshCw } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import { Button, Form, Spinner, Alert } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import { loadPublicCatalogs, loadCatalogBlueprints, createOrder } from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import BaseSectionHeader from "@/Components/Base/BaseHeader";
import { BlueprintTable } from "@/Components/Blueprint/BlueprintTable";
import type { BlueprintItem } from "@/Components/Blueprint/BlueprintTableColumns";
import { OrderFloatingBar } from "@/Components/Blueprint/OrderFloatingBar";
import { OrderModal } from "@/Components/Blueprint/OrderModal";
import type { CartItem } from "@/Components/Blueprint/OrderModal";
import { OwnerCard } from "@/Components/Blueprint/OwnerCard";
import styles from "@/Styles/modules/Blueprint.module.css";
import { renderTooltip } from "@/Utils";

function MainPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedCatalogId, setSelectedCatalogId] = useQueryState("catalog", parseAsInteger);
  const [legacyShopId] = useQueryState("shop", parseAsInteger);
  const activeCatalogId = selectedCatalogId ?? legacyShopId;

  const [catalogTypeFilter, setCatalogTypeFilter] = useState<"all" | "bpo" | "bpc">("all");
  const [cart, setCart] = useState<Map<number, CartItem>>(new Map());
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Load public catalogs
  const {
    data: shops = [],
    isLoading: isShopsLoading,
    isError: isShopsError,
    refetch: refetchShops,
  } = useQuery({
    queryKey: queryKeys.PublicCatalogs,
    queryFn: loadPublicCatalogs,
  });

  const selectedOwner = shops.find((s) => s.id === activeCatalogId) ?? null;

  // Load blueprints for the selected owner
  const {
    data: blueprints = [],
    isLoading: isBlueprintsLoading,
  } = useQuery({
    queryKey: activeCatalogId ? queryKeys.CatalogBlueprints(activeCatalogId) : ["none"],
    queryFn: () => (activeCatalogId ? loadCatalogBlueprints(activeCatalogId) : Promise.resolve([])),
    enabled: Boolean(activeCatalogId),
  });

  // Order submission mutation
  const orderMutation = useMutation({
    mutationFn: (note: string) => {
      if (!activeCatalogId) throw new Error("No catalog selected.");
      const items = Array.from(cart.values()).map((c) => ({
        blueprint_id: c.blueprint.item_id,
        quantity: c.quantity,
        runs: c.runs,
      }));
      return createOrder({
        owner_id: activeCatalogId,
        note,
        items,
      });
    },
    onSuccess: () => {
      setCart(new Map());
      setShowOrderModal(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.Orders() });
    },
  });

  // Cart operations
  const handleToggleSelect = (bp: BlueprintItem) => {
    setCart((prev) => {
      const next = new Map(prev);
      if (next.has(bp.item_id)) {
        next.delete(bp.item_id);
      } else {
        next.set(bp.item_id, {
          blueprint: bp,
          quantity: 1,
          runs: bp.is_original ? 10 : bp.runs,
        });
      }
      return next;
    });
  };

  const handleUpdateQuantity = (blueprintId: number, quantity: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const item = next.get(blueprintId);
      if (item) {
        next.set(blueprintId, { ...item, quantity });
      }
      return next;
    });
  };

  const handleUpdateRuns = (blueprintId: number, runs: number | null) => {
    setCart((prev) => {
      const next = new Map(prev);
      const item = next.get(blueprintId);
      if (item) {
        next.set(blueprintId, { ...item, runs });
      }
      return next;
    });
  };

  const handleRemoveItem = (blueprintId: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(blueprintId);
      return next;
    });
  };

  const filteredShops = shops.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="d-flex flex-column gap-3">
      {/* Top Header */}
      <BaseSectionHeader name={selectedOwner ? selectedOwner.name : (activeCatalogId ? t("Blueprint Catalog") : t("Blueprints"))}>
        <div className="d-flex align-items-center gap-2">
          {activeCatalogId &&
            renderTooltip(
              t("All Blueprints"),
              <Button
                variant="secondary"
                size="sm"
                aria-label={t("All Blueprints")}
                onClick={() => {
                  setSelectedCatalogId(null);
                  setCatalogTypeFilter("all");
                  setCart(new Map());
                }}
                className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
              >
                <ArrowLeft size={16} />
              </Button>
            )}

          <Form.Select
            aria-label={t("Select Catalog")}
            size="sm"
            value={activeCatalogId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedCatalogId(val ? Number(val) : null);
              setCatalogTypeFilter("all");
              setCart(new Map());
            }}
            className={`bg-dark text-light border-secondary ${styles.catalogSelectDropdown}`}
          >
            <option value="">{t("All Blueprints (Overview)")}</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.is_corporation ? t("Corporation") : t("Personal")})
              </option>
            ))}
          </Form.Select>

          {!activeCatalogId &&
            renderTooltip(
              t("Refresh"),
              <Button
                variant="secondary"
                size="sm"
                onClick={() => refetchShops()}
                className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
              >
                <RefreshCw size={14} />
                <span className="d-none d-sm-inline">{t("Refresh")}</span>
              </Button>
            )}
        </div>
      </BaseSectionHeader>

      {/* View 1: Public Blueprint Catalog Directory */}
      {!activeCatalogId && (
        <section className="d-flex flex-column gap-3">
          <div className="aa-panel p-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <h4 className="text-light mb-1 fw-bold">{t("Public Blueprint Catalog")}</h4>
              <p className="text-secondary small mb-0">
                {t("Browse authorized blueprint providers, inspect their available BPO and BPC catalogs, and place orders.")}
              </p>
            </div>
            <div className={styles.catalogSearchInput}>
              <Form.Control
                type="text"
                placeholder={t("Search catalogs or owners...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-dark text-light border-secondary"
              />
            </div>
          </div>

          {isShopsLoading && (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <div className="text-secondary mt-2">{t("Loading catalogs...")}</div>
            </div>
          )}

          {isShopsError && (
            <Alert variant="danger" className="d-flex align-items-center gap-2">
              <AlertCircle size={18} />
              <span>{t("Failed to load blueprint catalogs. Please try again.")}</span>
            </Alert>
          )}

          {!isShopsLoading && !isShopsError && filteredShops.length === 0 && (
            <div className="aa-panel p-5 text-center text-secondary">
              <Store size={48} className="mb-2 opacity-50" />
              <div className="fs-5">{t("No public blueprints found.")}</div>
              <p className="small text-secondary mb-0">
                {t("Currently no corporation or pilot has published their blueprints.")}
              </p>
            </div>
          )}

          <div className="row g-3">
            {filteredShops.map((owner) => (
              <div className="col-12 col-md-6 col-lg-4" key={owner.id}>
                <OwnerCard
                  owner={owner}
                  onSelect={(o, initialType) => {
                    setSelectedCatalogId(o.id);
                    setCatalogTypeFilter(initialType ?? "all");
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* View 2: Selected Owner Blueprint Catalog */}
      {activeCatalogId && (
        <section className="d-flex flex-column gap-3">
          {!isShopsLoading && !selectedOwner && shops.length > 0 ? (
            <Alert variant="warning" className="d-flex align-items-center justify-content-between">
              <span>{t("Selected catalog was not found or is no longer public.")}</span>
              <Button
                variant="outline-warning"
                size="sm"
                onClick={() => {
                  setSelectedCatalogId(null);
                  setCatalogTypeFilter("all");
                  setCart(new Map());
                }}
              >
                {t("Return to Overview")}
              </Button>
            </Alert>
          ) : (
            <>
              <BlueprintTable
                data={blueprints}
                isFetching={isBlueprintsLoading}
                selectedBlueprints={cart}
                onToggleSelect={handleToggleSelect}
                showSelectColumn={true}
                typeFilter={catalogTypeFilter}
                onTypeFilterChange={setCatalogTypeFilter}
                onOpenOrderModal={() => setShowOrderModal(true)}
              />

              {/* Floating Cart Bar */}
              <OrderFloatingBar
                itemCount={cart.size}
                onOpenOrderModal={() => setShowOrderModal(true)}
                onClearCart={() => setCart(new Map())}
              />

              {/* Order Modal */}
              <OrderModal
                show={showOrderModal}
                onHide={() => setShowOrderModal(false)}
                shopName={selectedOwner?.name ?? t("Blueprint Catalog")}
                items={Array.from(cart.values())}
                onUpdateQuantity={handleUpdateQuantity}
                onUpdateRuns={handleUpdateRuns}
                onRemoveItem={handleRemoveItem}
                onSubmitOrder={async (note) => {
                  await orderMutation.mutateAsync(note);
                }}
                isSubmitting={orderMutation.isPending}
              />
            </>
          )}
        </section>
      )}
    </main>
  );
}

export default MainPage;
