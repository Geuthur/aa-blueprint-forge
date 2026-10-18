// React
import { useSearchParams } from "react-router";

// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, Button, Spinner } from "react-bootstrap";
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
import { OrdersEmptyState } from "@/Components/Orders/OrdersEmptyState";
import { OrdersTabBar, type OrderTab } from "@/Components/Orders/OrdersTabBar";

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
          <div className="text-light mt-2">{t("Loading orders...")}</div>
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
