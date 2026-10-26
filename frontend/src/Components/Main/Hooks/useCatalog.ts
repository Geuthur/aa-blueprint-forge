// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// AA bpforge
// AA Blueprint Forge
import {
  createOrder,
  loadCatalogBlueprints,
  loadPublicCatalogs,
  searchPublicBlueprints,
} from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";

/** Loads the public catalogs. */
export function usePublicCatalogs() {
  return useQuery({
    queryKey: queryKeys.PublicCatalogs,
    queryFn: loadPublicCatalogs,
  });
}

/** Loads the blueprints of a catalog; stays disabled while no catalog is selected. */
export function useCatalogBlueprints(catalogId: number | null) {
  return useQuery({
    queryKey: catalogId ? queryKeys.CatalogBlueprints(catalogId) : ["none"],
    queryFn: () => (catalogId ? loadCatalogBlueprints(catalogId) : Promise.resolve([])),
    enabled: Boolean(catalogId),
  });
}

/** Searches the blueprints of all public catalogs; only runs while `enabled` is true. */
export function useSearchPublicBlueprints(term: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.SearchPublicBlueprints(term),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.Orders() });
    },
  });
}
