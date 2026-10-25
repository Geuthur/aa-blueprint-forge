// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// AA bpforge
// AA Blueprint Forge
import { deleteOrder, loadOrders, updateOrderStatus } from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";

type OrdersScope = "buyer" | "seller" | "all" | "manage";

const isOpen = (status: string) => status === "Pending" || status === "Accepted";

/** Loads the orders of the selected tab. */
export function useOrders(tab: OrdersScope) {
  return useQuery({
    queryKey: queryKeys.Orders(tab),
    queryFn: () => loadOrders(tab),
  });
}

/**
 * Counts the open orders (pending or accepted) of the seller or manager view.
 * The orders are polled every 10 seconds so the tab badge stays current.
 */
export function useOpenOrderCount(scope: "seller" | "manage", enabled = true) {
  const { data = [] } = useQuery({
    queryKey: queryKeys.Orders(scope),
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
        queryClient.invalidateQueries({ queryKey: queryKeys.Orders() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.OrderDetail(variables.orderId) }),
      ]);
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (orderId: number) => deleteOrder(orderId),
    onSuccess: async (_, orderId) => {
      queryClient.removeQueries({ queryKey: queryKeys.OrderDetail(orderId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.Orders() });
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
