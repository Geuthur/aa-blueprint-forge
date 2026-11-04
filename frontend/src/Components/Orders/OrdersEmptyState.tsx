// React
import React from "react";

// Third Party
import { ShoppingBag } from "lucide-react";
import { Card } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
// AA Blueprint Forge
import type { OrderTab } from "@/Components/Orders/OrdersTabBar";

interface OrdersEmptyStateProps {
  activeTab: OrderTab;
}

export const OrdersEmptyState: React.FC<OrdersEmptyStateProps> = ({ activeTab }) => {
  const { t } = useTranslation();

  return (
    <Card className="bg-secondary text-light border-0 shadow-sm">
      <Card.Body className="p-5 text-center text-light">
        <ShoppingBag size={48} className="mb-2 opacity-50" />
        <div className="fs-5">{t("No orders found.")}</div>
        <p className="small text-light mb-0">
          {activeTab === "buyer"
            ? t("You have no open blueprint orders.")
            : activeTab === "seller"
              ? t("Your shop has no open orders.")
              : activeTab === "manage"
                ? t("No manageable orders found.")
                : activeTab === "history"
                  ? t("No closed orders found.")
                  : t("No orders found.")}
        </p>
      </Card.Body>
    </Card>
  );
};
