// React
import React from "react";

// Third Party
import { Inbox, Send, Shield } from "lucide-react";
import { Badge, Button, ButtonGroup } from "react-bootstrap";
import { useTranslation } from "react-i18next";

export type OrderTab = "buyer" | "seller" | "all" | "manage";

interface OrdersTabBarProps {
  activeTab: OrderTab;
  onSelectTab: (tab: OrderTab) => void;
  openSellerCount: number;
  canManageOrders: boolean;
  openManageCount: number;
}

export const OrdersTabBar: React.FC<OrdersTabBarProps> = ({
  activeTab,
  onSelectTab,
  openSellerCount,
  canManageOrders,
  openManageCount,
}) => {
  const { t } = useTranslation();

  return (
    <ButtonGroup className="w-100 border border-secondary" role="tablist">
      <Button
        variant={activeTab === "buyer" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"}
        role="tab"
        aria-selected={activeTab === "buyer"}
        onClick={() => onSelectTab("buyer")}
        className={`d-flex align-items-center justify-content-center gap-2 flex-fill py-2 px-3 aa-btn ${
          activeTab === "buyer" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"
        }`}
      >
        <Send size={15} />
        <span>{t("My Orders (as Buyer)")}</span>
      </Button>

      <Button
        variant={activeTab === "seller" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"}
        role="tab"
        aria-selected={activeTab === "seller"}
        onClick={() => onSelectTab("seller")}
        className={`d-flex align-items-center justify-content-center gap-2 flex-fill py-2 px-3 aa-btn ${
          activeTab === "seller" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"
        } ${openSellerCount > 0 ? "aa-order-nav-pulse" : ""}`}
      >
        <Inbox size={15} />
        <span>{t("Catalog Orders (as Seller)")}</span>
        {openSellerCount > 0 && (
          <Badge pill className="aa-order-badge ms-1" data-testid="seller-orders-badge">
            {openSellerCount}
          </Badge>
        )}
      </Button>

      <Button
        variant={activeTab === "all" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"}
        role="tab"
        aria-selected={activeTab === "all"}
        onClick={() => onSelectTab("all")}
        className={`d-flex align-items-center justify-content-center gap-2 flex-fill py-2 px-3 aa-btn ${
          activeTab === "all" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"
        }`}
      >
        <span>{t("All Orders")}</span>
      </Button>

      {canManageOrders && (
        <Button
          variant={activeTab === "manage" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"}
          role="tab"
          aria-selected={activeTab === "manage"}
          onClick={() => onSelectTab("manage")}
          className={`d-flex align-items-center justify-content-center gap-2 flex-fill py-2 px-3 aa-btn ${
            activeTab === "manage" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"
          } ${openManageCount > 0 ? "aa-order-nav-pulse" : ""}`}
        >
          <Shield size={15} />
          <span>{t("Order Management (Verwalter)")}</span>
          {openManageCount > 0 && (
            <Badge pill className="aa-order-badge ms-1" data-testid="manage-orders-badge">
              {openManageCount}
            </Badge>
          )}
        </Button>
      )}
    </ButtonGroup>
  );
};
