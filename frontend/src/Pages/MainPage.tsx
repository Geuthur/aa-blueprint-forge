// React
import { useMemo, useState } from "react";

// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import { Button, Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import {
  createOrder,
  loadCatalogBlueprints,
  loadPublicCatalogs,
  searchPublicBlueprints,
} from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import BaseSectionHeader from "@/Components/Base/BaseHeader";
import type { BlueprintItem } from "@/Components/BlueprintTable/BlueprintTableColumns";
import { CatalogDetailSection } from "@/Components/Main/CatalogDetailSection";
import { CatalogDirectorySection } from "@/Components/Main/CatalogDirectorySection";
import type { CartItem } from "@/Components/Main/OrderModal";
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

  const selectedOwner = shops.find((s) => s.id === activeCatalogId) ?? undefined;

  // Load blueprints for the selected owner
  const {
    data: blueprints = [],
    isLoading: isBlueprintsLoading,
    refetch: refetchBlueprints,
  } = useQuery({
    queryKey: activeCatalogId ? queryKeys.CatalogBlueprints(activeCatalogId) : ["none"],
    queryFn: () => (activeCatalogId ? loadCatalogBlueprints(activeCatalogId) : Promise.resolve([])),
    enabled: Boolean(activeCatalogId),
  });

  const trimmedSearch = searchTerm.trim();
  const isSearchingBlueprints = trimmedSearch.length >= 2;

  // Search blueprints across public catalogs when search term >= 2 characters
  const {
    data: searchResults = [],
    isFetching: isSearchFetching,
  } = useQuery({
    queryKey: queryKeys.SearchPublicBlueprints(trimmedSearch),
    queryFn: () => searchPublicBlueprints(trimmedSearch),
    enabled: isSearchingBlueprints && !activeCatalogId,
    staleTime: 10000,
  });

  const matchingByOwner = useMemo(() => {
    const map: Record<number, BlueprintItem[]> = {};
    for (const bp of searchResults) {
      if (!map[bp.owner_id]) {
        map[bp.owner_id] = [];
      }
      map[bp.owner_id].push(bp as BlueprintItem);
    }
    return map;
  }, [searchResults]);

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

  const handleBackToDirectory = () => {
    setSelectedCatalogId(null);
    setCatalogTypeFilter("all");
    setCart(new Map());
  };

  return (
    <main className="d-flex flex-column gap-3">
      {/* Top Header */}
      <BaseSectionHeader
        name={
          selectedOwner
            ? selectedOwner.name
            : activeCatalogId
              ? t("Blueprint Catalog")
              : t("Blueprints")
        }
      >
        <div className="d-flex align-items-center gap-2">
          {activeCatalogId &&
            renderTooltip(
              t("All Blueprints"),
              <Button
                variant="secondary"
                size="sm"
                aria-label={t("All Blueprints")}
                onClick={handleBackToDirectory}
                className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
              >
                <span>{t("All Blueprints")}</span>
              </Button>
            )}

          {/* Catalog select dropdown */}
          <Form.Select
            size="sm"
            value={activeCatalogId ?? ""}
            aria-label={t("Select Catalog")}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedCatalogId(val ? Number(val) : null);
              setCatalogTypeFilter("all");
              setCart(new Map());
            }}
            className={styles.catalogSelectDropdown}
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
        <CatalogDirectorySection
          shops={shops}
          isLoading={isShopsLoading}
          isError={isShopsError}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isSearchFetching={isSearchFetching}
          searchResults={matchingByOwner}
          onSelectShop={(o, initialType) => {
            setSelectedCatalogId(o.id);
            setCatalogTypeFilter(initialType ?? "all");
          }}
        />
      )}

      {/* View 2: Selected Owner Blueprint Catalog */}
      {activeCatalogId && (
        <CatalogDetailSection
          selectedOwner={selectedOwner}
          blueprints={blueprints}
          isBlueprintsLoading={isBlueprintsLoading}
          catalogTypeFilter={catalogTypeFilter}
          onCatalogTypeFilterChange={setCatalogTypeFilter}
          cart={cart}
          onToggleSelect={handleToggleSelect}
          onUpdateQuantity={handleUpdateQuantity}
          onUpdateRuns={handleUpdateRuns}
          onRemoveItem={handleRemoveItem}
          onClearCart={() => setCart(new Map())}
          showOrderModal={showOrderModal}
          onOpenOrderModal={() => setShowOrderModal(true)}
          onCloseOrderModal={() => setShowOrderModal(false)}
          onSubmitOrder={async (note) => {
            await orderMutation.mutateAsync(note);
          }}
          isSubmittingOrder={orderMutation.isPending}
          onBackToDirectory={handleBackToDirectory}
          onRefetchBlueprints={() => refetchBlueprints()}
        />
      )}
    </main>
  );
}

export default MainPage;
