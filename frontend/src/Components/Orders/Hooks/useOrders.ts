// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// AA bpforge
import { deleteOrder, loadOrders, ordersQueryKeys, updateOrderStatus } from "@/Api/calls/orders";

type OrdersScope = "buyer" | "seller" | "all" | "manage" | "history";

const isOpen = (status: string) => status === "Pending" || status === "Accepted";

/** Loads the orders of the selected tab. */
export function useOrders(tab: OrdersScope) {
  return useQuery({
    queryKey: ordersQueryKeys.orders(tab),
    queryFn: () => loadOrders(tab),
  });
}

/**
 * Counts the open orders (pending or accepted) of the seller or manager view.
 * The orders are polled every 10 seconds so the tab badge stays current.
 */
export function useOpenOrderCount(scope: "seller" | "manage", enabled = true) {
  const { data = [] } = useQuery({
    queryKey: ordersQueryKeys.orders(scope),
    queryFn: () => loadOrders(scope),
    enabled,
    refetchInterval: 10000,
    staleTime: 5000,
  });
  return data.filter((order) => isOpen(order.status)).length;
}

/** Changes the status of an order or deletes it, and refreshes the order lists. */
export function useOrderActions() {
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: string }) =>
      updateOrderStatus(orderId, status),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ordersQueryKeys.orders() }),
        queryClient.invalidateQueries({ queryKey: ordersQueryKeys.order(variables.orderId) }),
      ]);
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (orderId: number) => deleteOrder(orderId),
    onSuccess: async (_, orderId) => {
      queryClient.removeQueries({ queryKey: ordersQueryKeys.order(orderId) });
      await queryClient.invalidateQueries({ queryKey: ordersQueryKeys.orders() });
    },
  });

  return {
    updateStatus: async (orderId: number, status: string): Promise<void> => {
      await updateStatusMutation.mutateAsync({ orderId, status });
    },
    isUpdating: updateStatusMutation.isPending,
    remove: async (orderId: number): Promise<void> => {
      await deleteOrderMutation.mutateAsync(orderId);
    },
    isDeleting: deleteOrderMutation.isPending,
  };
}
