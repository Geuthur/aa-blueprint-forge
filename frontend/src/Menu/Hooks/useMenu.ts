// Third Party
import { useQuery } from "@tanstack/react-query";

// AA bpforge
// AA Blueprint Forge
import { loadMenu, loadOrders, loadUserOwners } from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import { useUserData } from "@/Hooks/useUserData";

/** Loads the left and right menu links. */
export function useMenu() {
  return useQuery({
    queryKey: queryKeys.Menu,
    queryFn: () => loadMenu(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * Counts the open orders (pending or accepted) the user handles for the orders menu badge:
 * the seller orders and, for order managers, the manageable orders. Refreshed every 30 seconds.
 */
export function useMenuOpenOrderCount() {
  const { data: userData } = useUserData();
  const { data: sellerOrders = [] } = useQuery({
    queryKey: queryKeys.Orders("seller"),
    queryFn: () => loadOrders("seller"),
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const { data: manageOrders = [] } = useQuery({
    queryKey: queryKeys.Orders("manage"),
    queryFn: () => loadOrders("manage"),
    enabled: Boolean(userData?.user.can_manage_orders),
    refetchInterval: 30000,
    staleTime: 15000,
  });
  // An order can be in both lists and counts once
  const openOrderIds = new Set(
    [...sellerOrders, ...manageOrders]
      .filter((o) => o.status === "Pending" || o.status === "Accepted")
      .map((o) => o.id)
  );
  return openOrderIds.size;
}

/** Loads the owners of the user, refreshed every 30 seconds, to show sync issues in the settings menu. */
export function useMenuUserOwners() {
  return useQuery({
    queryKey: queryKeys.UserOwners,
    queryFn: () => loadUserOwners(),
    refetchInterval: 30000,
    staleTime: 15000,
  });
}
