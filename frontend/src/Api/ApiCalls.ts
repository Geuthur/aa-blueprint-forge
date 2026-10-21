// AA bpforge
import { apiClient } from "@/Api/Api";
import type { components } from "@/Api/OpenApi";
import { ProjectName } from "@/configuration";

export async function loadUserData(): Promise<{ user: components["schemas"]["UserData"] }> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/user/`);
  if (error || !data) {
    throw new Error("Failed to load user data");
  }
  return { user: data };
}

export async function loadUserSettings(): Promise<components["schemas"]["UserSettingsSchema"]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/settings/`);
  if (error || !data) {
    throw new Error("Failed to load user settings");
  }
  return data;
}

export async function loadMenu(): Promise<components["schemas"]["MenuSchema"]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/menu/`);
  if (error || !data) {
    throw new Error("Failed to load menu");
  }
  return data;
}

export async function updateUserSettings(
  settings: components["schemas"]["UserSettingsUpdateRequest"],
): Promise<components["schemas"]["UserSettingsSchema"]> {
  const { data, error } = await apiClient.PUT(`/${ProjectName}/api/settings/`, {
    body: settings,
  });

  if (error || !data) {
    throw new Error("Failed to update user settings");
  }
  return data;
}

export async function loadUserOwners(): Promise<components["schemas"]["OwnerSettingSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/settings/owners/`);
  if (error || !data) {
    throw new Error("Failed to load owner settings");
  }
  return data;
}

export async function fetchUserCharacterStatuses(): Promise<components["schemas"]["UserCharacterStatusSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/user/characters/status/`);
  if (error || !data) {
    throw new Error("Failed to load character update statuses");
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
    throw new Error("Failed to update owner setting");
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
    throw new Error("Failed to trigger owner update task");
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
    throw new Error("Failed to delete owner");
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
    throw new Error("Failed to trigger update all owners");
  }
  return data;
}

export async function loadPublicCatalogs(): Promise<components["schemas"]["OwnerPublicSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/blueprints/`);
  if (error || !data) {
    throw new Error("Failed to load public catalogs");
  }
  return data;
}
export const loadPublicShops = loadPublicCatalogs;
export const loadPublicBlueprints = loadPublicCatalogs;

export async function loadCatalogBlueprints(
  ownerId: number,
): Promise<components["schemas"]["BlueprintItemSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/blueprints/{owner_id}/`, {
    params: {
      path: { owner_id: ownerId },
    },
  });
  if (error || !data) {
    throw new Error("Failed to load catalog blueprints");
  }
  return data;
}
export const loadShopBlueprints = loadCatalogBlueprints;
export const loadOwnerBlueprints = loadCatalogBlueprints;

export async function searchPublicBlueprints(
  query: string,
): Promise<components["schemas"]["BlueprintItemSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/blueprints/search/`, {
    params: {
      query: { q: query },
    },
  });
  if (error || !data) {
    throw new Error("Failed to search public blueprints");
  }
  return data;
}

export async function loadMyBlueprints(): Promise<components["schemas"]["BlueprintItemSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/my-blueprints/`);
  if (error || !data) {
    throw new Error("Failed to load user blueprints");
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
    throw new Error("Failed to create order");
  }
  return data;
}

export async function loadOrders(
  role: "all" | "buyer" | "seller" | "manage" = "all",
): Promise<components["schemas"]["OrderSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/orders/`, {
    params: {
      query: { role },
    },
  });
  if (error || !data) {
    throw new Error("Failed to load orders");
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
    throw new Error("Failed to load order details");
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
    throw new Error("Failed to update order status");
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
    throw new Error("Failed to delete order");
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
    throw new Error("Failed to load owner BPOs");
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
    throw new Error("Failed to update offered BPOs");
  }
  return data as { success: boolean; count?: number };
}

export async function loadSuperuserGroups(): Promise<components["schemas"]["GroupSchema"][]> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/superuser/groups/`);
  if (error || !data) {
    throw new Error("Failed to load Alliance Auth groups");
  }
  return data;
}

export async function loadSuperuserSettings(): Promise<
  components["schemas"]["SuperuserNotificationSettingsSchema"]
> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/superuser/settings/`);
  if (error || !data) {
    throw new Error("Failed to load superuser notification settings");
  }
  return data;
}

export async function updateSuperuserSettings(
  payload: components["schemas"]["SuperuserNotificationSettingsSchema"],
): Promise<components["schemas"]["SuperuserNotificationSettingsSchema"]> {
  const { data, error } = await apiClient.PUT(`/${ProjectName}/api/superuser/settings/`, {
    body: payload,
  });
  if (error || !data) {
    throw new Error("Failed to update superuser notification settings");
  }
  return data;
}

export async function loadSuperuserOwners(): Promise<
  components["schemas"]["OwnerSettingSchema"][]
> {
  const { data, error } = await apiClient.GET(`/${ProjectName}/api/superuser/owners/`);
  if (error || !data) {
    throw new Error("Failed to load all owners for superuser");
  }
  return data;
}

export async function updateSuperuserOwner(
  ownerId: number,
  payload: components["schemas"]["SuperuserOwnerUpdateRequest"],
): Promise<components["schemas"]["OwnerSettingSchema"]> {
  const { data, error } = await apiClient.PATCH(
    `/${ProjectName}/api/superuser/owners/{owner_id}/`,
    {
      params: {
        path: { owner_id: ownerId },
      },
      body: payload,
    },
  );
  if (error || !data) {
    throw new Error("Failed to update owner by superuser");
  }
  return data;
}

export async function loadSuperuserOwnerBlueprints(
  ownerId: number,
): Promise<components["schemas"]["BlueprintItemSchema"][]> {
  const { data, error } = await apiClient.GET(
    `/${ProjectName}/api/superuser/owners/{owner_id}/blueprints/`,
    {
      params: {
        path: { owner_id: ownerId },
      },
    },
  );
  if (error || !data) {
    throw new Error("Failed to load owner blueprints for superuser");
  }
  return data;
}

export async function triggerSuperuserOwnerUpdate(
  ownerId: number,
  forceRefresh: boolean = false,
): Promise<components["schemas"]["TaskTriggerResponseSchema"]> {
  const { data, error } = await apiClient.POST(
    `/${ProjectName}/api/superuser/owners/{owner_id}/update/`,
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
    throw new Error("Failed to trigger owner update task");
  }
  return data;
}

export async function deleteSuperuserOwner(
  ownerId: number,
): Promise<components["schemas"]["TaskTriggerResponseSchema"]> {
  const { data, error } = await apiClient.DELETE(
    `/${ProjectName}/api/superuser/owners/{owner_id}/`,
    {
      params: {
        path: { owner_id: ownerId },
      },
    },
  );
  if (error || !data) {
    throw new Error("Failed to delete owner");
  }
  return data;
}

export async function triggerSuperuserGlobalUpdate(params: {
  target: "all" | "characters" | "corporations";
  forceRefresh?: boolean;
}): Promise<components["schemas"]["TaskTriggerResponseSchema"]> {
  const { data, error } = await apiClient.POST(
    `/${ProjectName}/api/superuser/tasks/queue/`,
    {
      body: {
        target: params.target,
        force_refresh: params.forceRefresh ?? false,
      },
    },
  );
  if (error || !data) {
    throw new Error("Failed to trigger global update task");
  }
  return data;
}



