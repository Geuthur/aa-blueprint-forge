// React
import { useState } from "react";

// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

// AA bpforge
// AA Blueprint Forge
import {
  deleteOwner,
  loadOwnerBpos,
  loadUserOwners,
  loadUserSettings,
  triggerOwnerUpdate,
  triggerUpdateAllUserOwners,
  updateOwnerBpos,
  updateOwnerSetting,
  updateUserSettings,
} from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import type { OwnerSettingSchema, UserSettingsSchema } from "@/Api/schema";
import { useCooldown, useOwnerCooldowns } from "@/Hooks/useCooldown";
import { useFeedback } from "@/Hooks/useFeedback";

/** Loads the user settings and updates them optimistically. */
export function useUserSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.UserSettings,
    queryFn: loadUserSettings,
  });

  const updateMutation = useMutation({
    mutationFn: updateUserSettings,
    onMutate: async (newSettings) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.UserSettings });
      const previous = queryClient.getQueryData<UserSettingsSchema>(queryKeys.UserSettings);
      queryClient.setQueryData<UserSettingsSchema>(queryKeys.UserSettings, newSettings);
      return { previous };
    },
    onError: (_error, _settings, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.UserSettings, context.previous);
      }
    },
    onSuccess: (savedSettings) => {
      queryClient.setQueryData(queryKeys.UserSettings, savedSettings);
    },
  });

  return { ...query, updateMutation };
}

/** Loads the owners of the current user. */
export function useUserOwners() {
  return useQuery({
    queryKey: queryKeys.UserOwners,
    queryFn: loadUserOwners,
  });
}

/** Changes the shop settings of an owner (visibility, public type, selective BPOs) optimistically. */
export function useUpdateOwnerSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOwnerSetting,
    onMutate: async ({ ownerId, payload }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.UserOwners });
      const previous = queryClient.getQueryData<OwnerSettingSchema[]>(queryKeys.UserOwners);
      queryClient.setQueryData<OwnerSettingSchema[]>(queryKeys.UserOwners, (old) =>
        old?.map((owner) =>
          owner.id === ownerId
            ? {
                ...owner,
                is_public:
                  payload.is_public !== undefined && payload.is_public !== null
                    ? payload.is_public
                    : owner.is_public,
                public_type: payload.public_type || owner.public_type,
                selective_bpo_enabled:
                  payload.selective_bpo_enabled !== undefined &&
                  payload.selective_bpo_enabled !== null
                    ? payload.selective_bpo_enabled
                    : owner.selective_bpo_enabled,
              }
            : owner,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.UserOwners, context.previous);
      }
    },
    onSuccess: (updatedOwner) => {
      queryClient.setQueryData<OwnerSettingSchema[]>(queryKeys.UserOwners, (old) =>
        old?.map((owner) => (owner.id === updatedOwner.id ? updatedOwner : owner)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.PublicCatalogs });
    },
  });
}

/**
 * Update-all, single update and delete for the owners on the settings page,
 * including feedback messages and cooldowns.
 */
export function useOwnerActions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { seconds: globalCooldown, start: startGlobalCooldown } = useCooldown();
  const { cooldowns: ownerCooldowns, start: startOwnerCooldown } = useOwnerCooldowns();
  const { feedback, showFeedback, clearFeedback } = useFeedback();
  const [updatingOwnerId, setUpdatingOwnerId] = useState<number | null>(null);

  const invalidateOwnerQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.UserOwners });
    queryClient.invalidateQueries({ queryKey: queryKeys.UserCharacterStatuses });
    queryClient.invalidateQueries({ queryKey: queryKeys.PublicCatalogs });
  };

  const updateAllMutation = useMutation({
    mutationFn: () => triggerUpdateAllUserOwners(false),
    onSuccess: (res) => {
      showFeedback("success", res.message || t("Update tasks queued successfully."));
      startGlobalCooldown(60);
      invalidateOwnerQueries();
    },
    onError: (err: unknown) => {
      showFeedback(
        "danger",
        err instanceof Error ? err.message : t("Failed to trigger update all tasks."),
      );
    },
  });

  const updateSingleMutation = useMutation({
    mutationFn: (ownerId: number) => triggerOwnerUpdate(ownerId, false),
    onSuccess: (res, ownerId) => {
      showFeedback("success", res.message || t("Update task queued successfully."));
      startOwnerCooldown(ownerId, 60);
      invalidateOwnerQueries();
    },
    onError: (err: unknown) => {
      showFeedback(
        "danger",
        err instanceof Error ? err.message : t("Failed to trigger owner update task."),
      );
    },
    onSettled: () => {
      setUpdatingOwnerId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ownerId: number) => deleteOwner(ownerId),
    onSuccess: (res) => {
      showFeedback("success", res.message || t("Owner deleted successfully."));
      invalidateOwnerQueries();
    },
    onError: (err: unknown) => {
      showFeedback("danger", err instanceof Error ? err.message : t("Failed to delete owner."));
    },
  });

  const updateOwner = (ownerId: number) => {
    setUpdatingOwnerId(ownerId);
    updateSingleMutation.mutate(ownerId);
  };

  return {
    feedback,
    clearFeedback,
    globalCooldown,
    ownerCooldowns,
    updatingOwnerId,
    updateAll: () => updateAllMutation.mutate(),
    isUpdatingAll: updateAllMutation.isPending,
    updateOwner,
    deleteOwner: (ownerId: number) => deleteMutation.mutateAsync(ownerId),
    isDeleting: deleteMutation.isPending,
  };
}

/** Loads the BPOs of an owner for the selection dialog; only runs while the dialog is open. */
export function useOwnerBpos(ownerId: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.OwnerBpos(ownerId),
    queryFn: () => loadOwnerBpos(ownerId),
    enabled: enabled && ownerId > 0,
  });
}

/**
 * Saves the BPOs an owner offers in its shop.
 * @param callbacks `onSaved` closes the dialog, `onError` shows the message in it
 */
export function useSaveOwnerBpos(
  ownerId: number,
  callbacks: { onSaved?: () => void; onError?: (message: string) => void } = {},
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => updateOwnerBpos(ownerId, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.OwnerBpos(ownerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.UserOwners });
      queryClient.invalidateQueries({ queryKey: queryKeys.PublicShops });
      queryClient.invalidateQueries({ queryKey: queryKeys.ShopBlueprints(ownerId) });
      callbacks.onSaved?.();
    },
    onError: (err: unknown) => {
      callbacks.onError?.(
        err instanceof Error ? err.message : t("Failed to save blueprint selection."),
      );
    },
  });
}
