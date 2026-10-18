// React
import React from "react";

// Third Party
import { AlertCircle, Store } from "lucide-react";
import { Alert, Form, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { components } from "@/Api/OpenApi";
import type { BlueprintItem } from "@/Components/BlueprintTable/BlueprintTableColumns";
import { OwnerCard } from "@/Components/Main/OwnerCard";
import styles from "@/Styles/modules/Blueprint.module.css";

type PublicOwner = components["schemas"]["OwnerPublicSchema"];

interface CatalogDirectorySectionProps {
  shops: PublicOwner[];
  isLoading: boolean;
  isError: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSearchFetching: boolean;
  searchResults: Record<number, BlueprintItem[]> | null;
  onSelectShop: (shop: PublicOwner, defaultFilter?: "all" | "bpo" | "bpc") => void;
}

export const CatalogDirectorySection: React.FC<CatalogDirectorySectionProps> = ({
  shops,
  isLoading,
  isError,
  searchTerm,
  onSearchChange,
  isSearchFetching,
  searchResults,
  onSelectShop,
}) => {
  const { t } = useTranslation();

  const filteredShops = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return shops;
    }
    const lower = searchTerm.toLowerCase();
    return shops.filter((s) => {
      const matchesOwner = s.name.toLowerCase().includes(lower);
      const matchesBlueprints = searchResults && (searchResults[s.id]?.length || 0) > 0;
      return matchesOwner || matchesBlueprints;
    });
  }, [shops, searchTerm, searchResults]);

  return (
    <section className="d-flex flex-column gap-3">
      <div className="aa-panel bg-dark p-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h4 className="mb-1 fw-bold">{t("Public Blueprint Catalog")}</h4>
          <p className="text-light small mb-0">
            {t(
              "Browse authorized blueprint providers, inspect their available BPO and BPC catalogs, and place orders."
            )}
          </p>
        </div>
        <div className={`${styles.catalogSearchInput} position-relative`}>
          <Form.Control
            type="text"
            placeholder={t("Search catalogs or blueprints...")}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pe-5"
          />
          {isSearchFetching && (
            <div
              className="position-absolute end-0 top-50 translate-middle-y me-3"
              style={{ pointerEvents: "none" }}
            >
              <Spinner animation="border" size="sm" variant="primary" />
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div className="text-light mt-2">{t("Loading public catalogs...")}</div>
        </div>
      )}

      {isError && (
        <Alert variant="danger" className="d-flex align-items-center gap-2">
          <AlertCircle size={18} />
          <span>{t("Failed to load public blueprint catalogs.")}</span>
        </Alert>
      )}

      {!isLoading && !isError && filteredShops.length === 0 && (
        <div className="aa-panel bg-dark p-5 text-center text-light">
          <Store size={48} className="mb-2 opacity-50" />
          <div className="fs-5">{t("No catalogs found")}</div>
          <p className="small text-light mb-0">
            {searchTerm.trim()
              ? t("No public catalogs or blueprints match your search.")
              : t("There are currently no public blueprint providers active.")}
          </p>
        </div>
      )}

      {!isLoading && !isError && filteredShops.length > 0 && (
        <div className="row g-3">
          {filteredShops.map((shop) => (
            <div key={shop.id} className="col-12 col-md-6 col-lg-4">
              <OwnerCard
                owner={shop}
                matchingBlueprints={searchResults ? searchResults[shop.id] : undefined}
                onSelect={onSelectShop}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
