// Third Party
import { apiErrorMessage } from "aa-geuthur-react";

// AA bpforge
import { apiClient } from "@/Api/Api";
import type { components } from "@/Api/OpenApi";
import { ProjectName } from "@/constants";

/** Query keys of the settings area (owners of the current user and their BPOs). */
export const settingsQueryKeys = {
  owners: ["UserOwners"] as const,
  characterStatuses: ["UserCharacterStatuses"] as const,
  ownerBpos: (ownerId: number) => ["OwnerBpos", ownerId] as const,
};

export async function loadUserOwners(): Promise<components["schemas"]["OwnerSettingSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/settings/owners/`);
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to load owner settings"));
  }
  return data;
}

export async function fetchUserCharacterStatuses(): Promise<components["schemas"]["UserCharacterStatusSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/user/characters/status/`);
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to load character update statuses"));
  }
  return data;
}

export async function updateOwnerSetting(params: {
  ownerId: number;
  payload: components["schemas"]["OwnerSettingUpdateRequest"];
}): Promise<components["schemas"]["OwnerSettingSchema"]> {
  const { data, error } = await apiClient.PATCH(
    `/${ProjectName}/api/settings/owners/{owner_id}/`,
    {
      params: {
        path: { owner_id: params.ownerId },
      },
      body: params.payload,
    },
  );

  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to update owner setting"));
  }
  return data;
}

export async function triggerOwnerUpdate(
  ownerId: number,
  forceRefresh: boolean = false,
): Promise<components["schemas"]["TaskTriggerResponseSchema"]> {
  const { data, error } = await apiClient.POST(
    `/${ProjectName}/api/settings/owners/{owner_id}/update/`,
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

export async function deleteOwner(
  ownerId: number,
): Promise<components["schemas"]["TaskTriggerResponseSchema"]> {
  const { data, error } = await apiClient.DELETE(
    `/${ProjectName}/api/settings/owners/{owner_id}/`,
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

export async function triggerUpdateAllUserOwners(
  forceRefresh: boolean = false,
): Promise<components["schemas"]["TaskTriggerResponseSchema"]> {
  const { data, error } = await apiClient.POST(
    `/${ProjectName}/api/settings/owners/update-all/`,
    {
      body: {
        force_refresh: forceRefresh,
      },
    },
  );
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to trigger update all owners"));
  }
  return data;
}

export async function loadOwnerBpos(
  ownerId: number,
): Promise<components["schemas"]["OwnerBpoItemSchema"][]> {
  const { data, error } = await apiClient.GET(
    `/${ProjectName}/api/settings/owners/{owner_id}/bpos/`,
    {
      params: {
        path: { owner_id: ownerId },
      },
    },
  );
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to load owner BPOs"));
  }
  return data;
}

export async function updateOwnerBpos(
  ownerId: number,
  offeredItemIds: number[],
): Promise<{ success: boolean; count?: number }> {
  const { data, error } = await apiClient.POST(
    `/${ProjectName}/api/settings/owners/{owner_id}/bpos/`,
    {
      params: {
        path: { owner_id: ownerId },
      },
      body: {
        offered_item_ids: offeredItemIds,
      },
    },
  );
  if (error || !data) {
    throw new Error(apiErrorMessage(error, "Failed to update offered BPOs"));
  }
  return data as { success: boolean; count?: number };
}
