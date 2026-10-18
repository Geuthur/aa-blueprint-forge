// React
import React from "react";

// Third Party
import { ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";

interface OrdersEmptyStateProps {
  activeTab: "buyer" | "seller" | "all" | "manage";
}

export const OrdersEmptyState: React.FC<OrdersEmptyStateProps> = ({ activeTab }) => {
  const { t } = useTranslation();

  return (
    <div className="aa-panel bg-dark p-5 text-center text-light">
      <ShoppingBag size={48} className="mb-2 opacity-50" />
      <div className="fs-5">{t("No orders found.")}</div>
      <p className="small text-light mb-0">
        {activeTab === "buyer"
          ? t("You have not placed any blueprint orders yet.")
          : activeTab === "seller"
            ? t("No orders have been received for your shop.")
            : activeTab === "manage"
              ? t("No manageable orders found.")
              : t("No orders found.")}
      </p>
    </div>
  );
};
