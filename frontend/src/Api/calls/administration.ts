// Third Party
import { apiErrorMessage } from "aa-geuthur-react";

// AA bpforge
import { apiClient } from "@/Api/Api";
import type { components } from "@/Api/OpenApi";
import { ProjectName } from "@/constants";

/** Query keys of the administration area. */
export const administrationQueryKeys = {
  groups: ["AdministrationGroups"] as const,
  settings: ["AdministrationSettings"] as const,
  owners: ["AdministrationOwners"] as const,
  ownerBlueprints: (ownerId: number) => ["AdministrationOwnerBlueprints", ownerId] as const,
};

export async function loadAdministrationGroups(): Promise<components["schemas"]["GroupSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/administration/groups/`);
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to load Alliance Auth groups"));
  }
  return data;
}

export async function loadAdministrationSettings(): Promise<
  components["schemas"]["AdministrationNotificationSettingsSchema"]
> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/administration/settings/`);
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to load administration notification settings"));
  }
  return data;
}

export async function updateAdministrationSettings(
  payload: components["schemas"]["AdministrationNotificationSettingsSchema"],
): Promise<components["schemas"]["AdministrationNotificationSettingsSchema"]> {
  const { data, error } = await apiClient.PUT(`/${ProjectName}/api/administration/settings/`, {
    body: payload,
  });
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to update administration notification settings"));
  }
  return data;
}

export async function loadAdministrationOwners(): Promise<
  components["schemas"]["OwnerSettingSchema"][]
> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/administration/owners/`);
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to load all owners for administration"));
  }
  return data;
}

export async function updateAdministrationOwner(
  ownerId: number,
  payload: components["schemas"]["AdministrationOwnerUpdateRequest"],
): Promise<components["schemas"]["OwnerSettingSchema"]> {
  const { data, error } = await apiClient.PATCH(
    `/${ProjectName}/api/administration/owners/{owner_id}/`,
    {
      params: {
        path: { owner_id: ownerId },
      },
      body: payload,
    },
  );
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to update owner by administration"));
  }
  return data;
}

export async function loadAdministrationOwnerBlueprints(
  ownerId: number,
): Promise<components["schemas"]["BlueprintItemSchema"][]> {
  const { data, error } = await apiClient.GET(
    `/${ProjectName}/api/administration/owners/{owner_id}/blueprints/`,
    {
      params: {
        path: { owner_id: ownerId },
      },
    },
  );
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to load owner blueprints for administration"));
  }
  return data;
}

export async function triggerAdministrationOwnerUpdate(
  ownerId: number,
  forceRefresh: boolean = false,
): Promise<components["schemas"]["TaskTriggerResponseSchema"]> {
  const { data, error } = await apiClient.POST(
    `/${ProjectName}/api/administration/owners/{owner_id}/update/`,
    {
      params: {
        path: { owner_id: ownerId },
      },
      body: {
        force_refresh: forceRefresh,
      },
    },
  );
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to trigger owner update task"));
  }
  return data;
}

export async function deleteAdministrationOwner(
  ownerId: number,
): Promise<components["schemas"]["TaskTriggerResponseSchema"]> {
  const { data, error } = await apiClient.DELETE(
    `/${ProjectName}/api/administration/owners/{owner_id}/`,
    {
      params: {
        path: { owner_id: ownerId },
      },
    },
  );
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to delete owner"));
  }
  return data;
}

export async function triggerAdministrationGlobalUpdate(params: {
  target: "all" | "characters" | "corporations";
  forceRefresh?: boolean;
}): Promise<components["schemas"]["TaskTriggerResponseSchema"]> {
  const { data, error } = await apiClient.POST(
    `/${ProjectName}/api/administration/tasks/queue/`,
    {
      body: {
        target: params.target,
        force_refresh: params.forceRefresh ?? false,
      },
    },
  );
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to trigger global update task"));
  }
  return data;
}
