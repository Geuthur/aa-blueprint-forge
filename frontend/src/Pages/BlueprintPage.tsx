// React
import { useSearchParams } from "react-router";

// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Inbox, RefreshCw, Send, Shield, ShoppingBag } from "lucide-react";
import { Alert, Badge, Button, ButtonGroup, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import {
  deleteOrder,
  loadOrders,
  loadUserData,
  updateOrderStatus,
} from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import BaseSectionHeader from "@/Components/Base/BaseHeader";
import { OrderCard } from "@/Components/Orders/OrderCard";

export function OrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");

  // Load user data for identifying current user ID and manager status
  const { data: userData } = useQuery({
    queryKey: queryKeys.User,
    queryFn: loadUserData,
  });

  const currentUserId = userData?.user.user_id;
  const canManageOrders = Boolean(userData?.user.can_manage_orders);

  const activeTab: "buyer" | "seller" | "all" | "manage" =
    urlTab === "manage" && canManageOrders
      ? "manage"
      : urlTab === "seller" || urlTab === "all" || urlTab === "buyer"
        ? urlTab
        : "buyer";

  const handleSelectTab = (tab: "buyer" | "seller" | "all" | "manage") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

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

  // Dedicated query for manageable orders to track open orders count and pulsing badge for managers
  const { data: manageOrders = [] } = useQuery({
    queryKey: queryKeys.Orders("manage"),
    queryFn: () => loadOrders("manage"),
    enabled: canManageOrders,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const openManageCount = manageOrders.filter(
    (o) => o.status === "Pending" || o.status === "Accepted",
  ).length;

  // Mutation for updating order status
  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: string }) =>
      updateOrderStatus(orderId, status),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.Orders() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.OrderDetail(variables.orderId),
        }),
      ]);
    },
  });

  // Mutation for deleting an order
  const deleteOrderMutation = useMutation({
    mutationFn: (orderId: number) => deleteOrder(orderId),
    onSuccess: async (_, orderId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.OrderDetail(orderId),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.Orders() });
    },
  });

  const handleUpdateStatus = async (orderId: number, status: string) => {
    await updateStatusMutation.mutateAsync({ orderId, status });
  };

  const handleDeleteOrder = async (orderId: number) => {
    await deleteOrderMutation.mutateAsync(orderId);
  };

  return (
    <main className="d-flex flex-column gap-3">
      <BaseSectionHeader name={t("Orders & Requests")}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
        >
          <RefreshCw size={14} />
          <span>{t("Refresh")}</span>
        </Button>
      </BaseSectionHeader>

      {/* Tabs */}
      <ButtonGroup className="w-100 border border-secondary" role="tablist">
        <Button
          variant={`${activeTab === "buyer" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"}`}
          role="tab"
          aria-selected={activeTab === "buyer"}
          onClick={() => handleSelectTab("buyer")}
          className={`d-flex align-items-center justify-content-center gap-2 flex-fill py-2 px-3 aa-btn ${activeTab === "buyer" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"
            }`}
        >
          <Send size={15} />
          <span>{t("My Orders (as Buyer)")}</span>
        </Button>

        <Button
          variant={`${activeTab === "seller" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"}`}
          role="tab"
          aria-selected={activeTab === "seller"}
          onClick={() => handleSelectTab("seller")}
          className={`d-flex align-items-center justify-content-center gap-2 flex-fill py-2 px-3 aa-btn ${activeTab === "seller" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"
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
          variant={`${activeTab === "all" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"}`}
          role="tab"
          aria-selected={activeTab === "all"}
          onClick={() => handleSelectTab("all")}
          className={`d-flex align-items-center justify-content-center gap-2 flex-fill py-2 px-3 aa-btn ${activeTab === "all" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"
            }`}
        >
          <span>{t("All Orders")}</span>
        </Button>

        {canManageOrders && (
          <Button
            variant={activeTab === "manage" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"}
            role="tab"
            aria-selected={activeTab === "manage"}
            onClick={() => handleSelectTab("manage")}
            className={`d-flex align-items-center justify-content-center gap-2 flex-fill py-2 px-3 aa-btn ${activeTab === "manage" ? "aa-btn-primary fw-semibold" : "aa-btn-secondary"
              } ${openManageCount > 0 ? "aa-order-nav-pulse" : ""}`}
          >
            <Shield size={15} />
            <span>{t("Order Management (Verwalter)")}</span>
            {openManageCount > 0 && (
              <Badge
                pill
                className="aa-order-badge ms-1"
                data-testid="manage-orders-badge"
              >
                {openManageCount}
              </Badge>
            )}
          </Button>
        )}
      </ButtonGroup>

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
              : activeTab === "seller"
                ? t("No orders have been received for your shop.")
                : activeTab === "manage"
                  ? t("No manageable orders found.")
                  : t("No orders found.")}
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
            canManageOrders={canManageOrders}
            onUpdateStatus={handleUpdateStatus}
            onDeleteOrder={handleDeleteOrder}
            isUpdating={updateStatusMutation.isPending}
            isDeleting={deleteOrderMutation.isPending}
          />
        ))}
      </section>
    </main>
  );
}

export default OrdersPage;
