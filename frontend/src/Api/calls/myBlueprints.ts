// Third Party
import { apiErrorMessage } from "aa-geuthur-react";

// AA bpforge
import { apiClient } from "@/Api/Api";
import type { components } from "@/Api/OpenApi";
import { ProjectName } from "@/constants";

/** Query keys of the "My Blueprints" area. */
export const myBlueprintsQueryKeys = {
  blueprints: ["MyBlueprints"] as const,
};

export async function loadMyBlueprints(): Promise<components["schemas"]["BlueprintItemSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/my-blueprints/`);
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to load user blueprints"));
  }
  return data;
}
