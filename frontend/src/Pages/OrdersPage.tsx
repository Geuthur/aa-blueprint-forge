// React
import { useState } from "react";

// Third Party
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, RefreshCw, AlertCircle, Inbox, Send } from "lucide-react";
import { Button, ButtonGroup, Spinner, Alert, Badge } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import { loadOrders, updateOrderStatus, loadUserData } from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import BaseSectionHeader from "@/Components/Base/BaseHeader";
import { OrderCard } from "@/Components/Orders/OrderCard";

export function OrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"buyer" | "seller" | "all">("buyer");

  // Load user data for identifying current user ID
  const { data: userData } = useQuery({
    queryKey: queryKeys.User,
    queryFn: loadUserData,
  });

  const currentUserId = userData?.user.user_id;

  // Load orders
  const {
    data: orders = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.Orders(activeTab),
    queryFn: () => loadOrders(activeTab),
  });

  // Dedicated query for seller orders to track open seller orders count and pulsing badge
  const { data: sellerOrders = [] } = useQuery({
    queryKey: queryKeys.Orders("seller"),
    queryFn: () => loadOrders("seller"),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const openSellerCount = sellerOrders.filter(
    (o) => o.status === "Pending" || o.status === "Accepted",
  ).length;

  // Mutation for updating order status
  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: string }) =>
      updateOrderStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.Orders() });
    },
  });

  const handleUpdateStatus = async (orderId: number, status: string) => {
    await updateStatusMutation.mutateAsync({ orderId, status });
  };

  return (
    <main className="d-flex flex-column gap-3">
      <BaseSectionHeader name={t("Orders & Requests")}>
        <Button
          size="sm"
          onClick={() => refetch()}
          className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
        >
          <RefreshCw size={14} />
          <span>{t("Refresh")}</span>
        </Button>
      </BaseSectionHeader>

      {/* Tabs */}
      <div className="aa-panel p-2">
        <ButtonGroup className="w-100" role="tablist">
          <Button
            type="button"
            role="tab"
            aria-selected={activeTab === "buyer"}
            onClick={() => setActiveTab("buyer")}
            className={`d-flex align-items-center justify-content-center gap-2 flex-fill py-2 px-3 aa-btn ${
              activeTab === "buyer" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"
            }`}
          >
            <Send size={15} />
            <span>{t("My Orders (as Buyer)")}</span>
          </Button>

          <Button
            type="button"
            role="tab"
            aria-selected={activeTab === "seller"}
            onClick={() => setActiveTab("seller")}
            className={`d-flex align-items-center justify-content-center gap-2 flex-fill py-2 px-3 aa-btn ${
              activeTab === "seller" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"
            } ${openSellerCount > 0 ? "aa-order-nav-pulse" : ""}`}
          >
            <Inbox size={15} />
            <span>{t("Catalog Orders (as Seller)")}</span>
            {openSellerCount > 0 && (
              <Badge
                pill
                className="aa-order-badge ms-1"
                data-testid="seller-orders-badge"
              >
                {openSellerCount}
              </Badge>
            )}
          </Button>

          <Button
            type="button"
            role="tab"
            aria-selected={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            className={`d-flex align-items-center justify-content-center gap-2 flex-fill py-2 px-3 aa-btn ${
              activeTab === "all" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"
            }`}
          >
            <span>{t("All Orders")}</span>
          </Button>
        </ButtonGroup>
      </div>

      {isLoading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div className="text-secondary mt-2">{t("Loading orders...")}</div>
        </div>
      )}

      {isError && (
        <Alert variant="danger" className="d-flex align-items-center gap-2">
          <AlertCircle size={18} />
          <span>{t("Failed to load orders. Please try again.")}</span>
        </Alert>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <div className="aa-panel p-5 text-center text-secondary">
          <ShoppingBag size={48} className="mb-2 opacity-50" />
          <div className="fs-5">{t("No orders found.")}</div>
          <p className="small text-secondary mb-0">
            {activeTab === "buyer"
              ? t("You have not placed any blueprint orders yet.")
              : t("No orders have been received for your shop.")}
          </p>
        </div>
      )}

      {/* Orders List */}
      <section>
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            currentUserId={currentUserId}
            onUpdateStatus={handleUpdateStatus}
            isUpdating={updateStatusMutation.isPending}
          />
        ))}
      </section>
    </main>
  );
}

export default OrdersPage;
