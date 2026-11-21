// Third Party
import { apiErrorMessage } from "aa-geuthur-react";

// AA bpforge
import { apiClient } from "@/Api/Api";
import type { components } from "@/Api/OpenApi";
import { ProjectName } from "@/constants";

/** Query keys of the catalog area (public catalogs, their blueprints, search and new orders). */
export const catalogQueryKeys = {
  catalogs: ["PublicCatalogs"] as const,
  blueprints: (ownerId: number) => ["CatalogBlueprints", ownerId] as const,
  search: (query: string) => ["SearchPublicBlueprints", query] as const,
};

export async function loadPublicCatalogs(): Promise<components["schemas"]["OwnerPublicSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/blueprints/`);
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to load public catalogs"));
  }
  return data;
}

export async function loadCatalogBlueprints(
  ownerId: number,
): Promise<components["schemas"]["BlueprintItemSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/blueprints/{owner_id}/`, {
    params: {
      path: { owner_id: ownerId },
    },
  });
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to load catalog blueprints"));
  }
  return data;
}

export async function searchPublicBlueprints(
  query: string,
): Promise<components["schemas"]["BlueprintItemSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/blueprints/search/`, {
    params: {
      query: { q: query },
    },
  });
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to search public blueprints"));
  }
  return data;
}

export async function createOrder(
  payload: components["schemas"]["OrderCreateRequest"],
): Promise<components["schemas"]["OrderSchema"]> {
  const { data, error } = await apiClient.POST(`/${ProjectName}/api/orders/`, {
    body: payload,
  });
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to create order"));
  }
  return data;
}
