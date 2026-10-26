// React
import { useSearchParams } from "react-router-dom";

// Third Party
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, Button, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import BaseSectionHeader from "@/Components/Base/BaseHeader";
import { useOpenOrderCount, useOrderActions, useOrders } from "@/Components/Orders/Hooks";
import { OrderCard } from "@/Components/Orders/OrderCard";
import { OrdersEmptyState } from "@/Components/Orders/OrdersEmptyState";
import { OrdersTabBar, type OrderTab } from "@/Components/Orders/OrdersTabBar";
import { useUserData } from "@/Hooks/useUserData";

export function OrdersPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");

  // Load user data for identifying current user ID and manager status
  const { data: userData } = useUserData();

  const currentUserId = userData?.user.user_id;
  const canManageOrders = Boolean(userData?.user.can_manage_orders);

  const activeTab: OrderTab =
    urlTab === "manage" && canManageOrders
      ? "manage"
      : urlTab === "seller" || urlTab === "all" || urlTab === "buyer"
        ? urlTab
        : "buyer";

  const handleSelectTab = (tab: OrderTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  // Orders of the selected tab and the open order counts for the tab badges
  const { data: orders = [], isLoading, isError, refetch } = useOrders(activeTab);
  const openSellerCount = useOpenOrderCount("seller");
  const openManageCount = useOpenOrderCount("manage", canManageOrders);

  const { updateStatus, remove, isUpdating, isDeleting } = useOrderActions();

  return (
    <main className="d-flex flex-column gap-3">
      <BaseSectionHeader name={t("Orders & Requests")}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          className="d-flex align-items-center gap-1"
        >
          <RefreshCw size={14} />
          <span>{t("Refresh")}</span>
        </Button>
      </BaseSectionHeader>

      {/* Tabs */}
      <OrdersTabBar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        openSellerCount={openSellerCount}
        canManageOrders={canManageOrders}
        openManageCount={openManageCount}
      />

      {isLoading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div className="text-light mt-2">{t("Loading orders…")}</div>
        </div>
      )}

      {isError && (
        <Alert variant="danger" className="d-flex align-items-center gap-2">
          <AlertCircle size={18} />
          <span>{t("Failed to load orders. Please try again.")}</span>
        </Alert>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <OrdersEmptyState activeTab={activeTab} />
      )}

      {/* Orders List */}
      <section>
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            currentUserId={currentUserId}
            canManageOrders={canManageOrders}
            onUpdateStatus={updateStatus}
            onDeleteOrder={remove}
            isUpdating={isUpdating}
            isDeleting={isDeleting}
          />
        ))}
      </section>
    </main>
  );
}

export default OrdersPage;
