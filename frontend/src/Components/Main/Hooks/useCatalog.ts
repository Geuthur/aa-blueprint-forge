// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// AA bpforge
import {
  catalogQueryKeys,
  createOrder,
  loadCatalogBlueprints,
  loadPublicCatalogs,
  searchPublicBlueprints,
} from "@/Api/calls/catalog";
import { ordersQueryKeys } from "@/Api/calls/orders";

/** Loads the public catalogs. */
export function usePublicCatalogs() {
  return useQuery({
    queryKey: catalogQueryKeys.catalogs,
    queryFn: loadPublicCatalogs,
  });
}

/** Loads the blueprints of a catalog; stays disabled while no catalog is selected. */
export function useCatalogBlueprints(catalogId: number | null) {
  return useQuery({
    queryKey: catalogId ? catalogQueryKeys.blueprints(catalogId) : ["none"],
    queryFn: () => (catalogId ? loadCatalogBlueprints(catalogId) : Promise.resolve([])),
    enabled: Boolean(catalogId),
  });
}

/** Searches the blueprints of all public catalogs; only runs while `enabled` is true. */
export function useSearchPublicBlueprints(term: string, enabled: boolean) {
  return useQuery({
    queryKey: catalogQueryKeys.search(term),
    queryFn: () => searchPublicBlueprints(term),
    enabled,
    staleTime: 10000,
  });
}

/**
 * Submits an order for a catalog.
 * @param onCreated Called after the order was created (clears the cart)
 */
export function useCreateOrder(onCreated?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createOrder>[0]) => createOrder(payload),
    onSuccess: () => {
      onCreated?.();
      queryClient.invalidateQueries({ queryKey: ordersQueryKeys.orders() });
    },
  });
}
