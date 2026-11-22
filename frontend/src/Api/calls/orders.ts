// Third Party
import { apiErrorMessage } from "aa-geuthur-react";

// AA bpforge
import { apiClient } from "@/Api/Api";
import type { components } from "@/Api/OpenApi";
import { ProjectName } from "@/constants";

/** Query keys of the orders area. */
export const ordersQueryKeys = {
  orders: (role?: string) => (role ? (["Orders", role] as const) : (["Orders"] as const)),
  order: (orderId: number) => ["OrderDetail", orderId] as const,
};

export async function loadOrders(
  role: "all" | "buyer" | "seller" | "manage" | "history" = "all",
): Promise<components["schemas"]["OrderSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/orders/`, {
    params: {
      query: { role },
    },
  });
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to load orders"));
  }
  return data;
}

export async function loadOrder(
  orderId: number,
): Promise<components["schemas"]["OrderSchema"]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/orders/{order_id}/`, {
    params: {
      path: { order_id: orderId },
    },
  });
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to load order details"));
  }
  return data;
}

export async function updateOrderStatus(
  orderId: number,
  status: string,
): Promise<components["schemas"]["OrderSchema"]> {
  const { data, error } = await apiClient.POST(`/${ProjectName}/api/orders/{order_id}/status/`, {
    params: {
      path: { order_id: orderId },
    },
    body: { status },
  });
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to update order status"));
  }
  return data;
}

export async function deleteOrder(
  orderId: number,
): Promise<components["schemas"]["TaskTriggerResponseSchema"]> {
  const { data, error } = await apiClient.DELETE(`/${ProjectName}/api/orders/{order_id}/`, {
    params: {
      path: { order_id: orderId },
    },
  });
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to delete order"));
  }
  return data;
}
