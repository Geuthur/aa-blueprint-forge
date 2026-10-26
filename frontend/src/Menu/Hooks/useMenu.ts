// Third Party
import { useQuery } from "@tanstack/react-query";

// AA bpforge
// AA Blueprint Forge
import { loadMenu, loadOrders, loadUserOwners } from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";

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

/** Counts the open seller orders (pending or accepted) for the orders menu badge, refreshed every 30 seconds. */
export function useMenuOpenOrderCount() {
  const { data } = useQuery({
    queryKey: queryKeys.Orders("seller"),
    queryFn: () => loadOrders("seller"),
    refetchInterval: 30000,
    staleTime: 15000,
  });
  return (data ?? []).filter((o) => o.status === "Pending" || o.status === "Accepted").length;
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
