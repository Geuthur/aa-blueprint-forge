// React
import React from "react";

// Third Party
import { Inbox, Send, Shield } from "lucide-react";
import { Badge, Nav } from "react-bootstrap";
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

  const linkClass = "d-flex align-items-center justify-content-center gap-2 py-2 px-3";

  return (
    <Nav
      variant="pills"
      fill
      role="tablist"
      activeKey={activeTab}
      onSelect={(key) => key && onSelectTab(key as OrderTab)}
      className="w-100 border border-secondary"
    >
      <Nav.Item>
        <Nav.Link as="button" type="button" eventKey="buyer" role="tab" aria-selected={activeTab === "buyer"} className={linkClass}>
          <Send size={15} />
          <span>{t("My Orders (as Buyer)")}</span>
        </Nav.Link>
      </Nav.Item>

      <Nav.Item>
        <Nav.Link
          as="button"
          type="button"
          eventKey="seller"
          role="tab"
          aria-selected={activeTab === "seller"}
          className={`${linkClass} ${openSellerCount > 0 ? "aa-order-nav-pulse" : ""}`}
        >
          <Inbox size={15} />
          <span>{t("Catalog Orders (as Seller)")}</span>
          {openSellerCount > 0 && (
            <Badge pill className="aa-order-badge ms-1" data-testid="seller-orders-badge">
              {openSellerCount}
            </Badge>
          )}
        </Nav.Link>
      </Nav.Item>

      <Nav.Item>
        <Nav.Link as="button" type="button" eventKey="all" role="tab" aria-selected={activeTab === "all"} className={linkClass}>
          <span>{t("All Orders")}</span>
        </Nav.Link>
      </Nav.Item>

      {canManageOrders && (
        <Nav.Item>
          <Nav.Link
            as="button"
            type="button"
            eventKey="manage"
            role="tab"
            aria-selected={activeTab === "manage"}
            className={`${linkClass} ${openManageCount > 0 ? "aa-order-nav-pulse" : ""}`}
          >
            <Shield size={15} />
            <span>{t("Order Management (Verwalter)")}</span>
            {openManageCount > 0 && (
              <Badge pill className="aa-order-badge ms-1" data-testid="manage-orders-badge">
                {openManageCount}
              </Badge>
            )}
          </Nav.Link>
        </Nav.Item>
      )}
    </Nav>
  );
};
