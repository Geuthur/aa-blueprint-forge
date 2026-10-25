// React
import { useState } from "react";

// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

// AA bpforge
// AA Blueprint Forge
import {
  deleteAdministrationOwner,
  loadAdministrationGroups,
  loadAdministrationOwnerBlueprints,
  loadAdministrationOwners,
  loadAdministrationSettings,
  triggerAdministrationGlobalUpdate,
  triggerAdministrationOwnerUpdate,
  updateAdministrationOwner,
  updateAdministrationSettings,
} from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import type { AdministrationOwnerUpdateRequest, OwnerSettingSchema } from "@/Api/schema";
import { useUserData } from "@/Hooks/useUserData";

/** Tells whether the current user is a superuser (global task queue and force refresh are reserved for them). */
export function useIsSuperuser() {
  const { data } = useUserData();
  return Boolean(data?.user.is_superuser);
}

/** Loads the Alliance Auth groups that can receive order notifications. */
export function useAdministrationGroups() {
  return useQuery({
    queryKey: queryKeys.AdministrationGroups,
    queryFn: loadAdministrationGroups,
  });
}

/** Loads the global notification settings. */
export function useAdministrationSettings() {
  return useQuery({
    queryKey: queryKeys.AdministrationSettings,
    queryFn: loadAdministrationSettings,
  });
}

/** Loads all owners of the Administration. */
export function useAdministrationOwners() {
  return useQuery({
    queryKey: queryKeys.AdministrationOwners,
    queryFn: loadAdministrationOwners,
  });
}

/** Loads the blueprints of the inspected owner; stays disabled while no owner is inspected. */
export function useAdministrationOwnerBlueprints(ownerId: number | null) {
  return useQuery({
    queryKey: ownerId ? queryKeys.AdministrationOwnerBlueprints(ownerId) : ["none"],
    queryFn: () => (ownerId ? loadAdministrationOwnerBlueprints(ownerId) : Promise.resolve([])),
    enabled: Boolean(ownerId),
  });
}

/**
 * Saves the global notification settings.
 * @param callbacks `onSaved` and `onError` update the form state of the caller
 */
export function useUpdateAdministrationSettings(
  callbacks: { onSaved?: () => void; onError?: (message: string) => void } = {},
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof updateAdministrationSettings>[0]) =>
      updateAdministrationSettings(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.AdministrationSettings, updated);
      callbacks.onSaved?.();
    },
    onError: (err: unknown) => {
      callbacks.onError?.(
        err instanceof Error ? err.message : t("Failed to update global notification settings."),
      );
    },
  });
}

/**
 * Saves the settings of one owner.
 * @param callbacks `onUpdated` and `onError` update the dialog state of the caller
 */
export function useUpdateAdministrationOwner(
  callbacks: { onUpdated?: () => void; onError?: (message: string) => void } = {},
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ownerId, payload }: { ownerId: number; payload: AdministrationOwnerUpdateRequest }) =>
      updateAdministrationOwner(ownerId, payload),
    onSuccess: (updatedOwner) => {
      queryClient.setQueryData<OwnerSettingSchema[]>(queryKeys.AdministrationOwners, (old) =>
        old?.map((o) => (o.id === updatedOwner.id ? updatedOwner : o)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.UserOwners });
      queryClient.invalidateQueries({ queryKey: queryKeys.PublicCatalogs });
      callbacks.onUpdated?.();
    },
    onError: (err: unknown) => {
      callbacks.onError?.(err instanceof Error ? err.message : t("Failed to update owner."));
    },
  });
}

/**
 * Owner update tasks, the global update queue and owner deletion, including the task feedback.
 * @param onSettledDelete Called after a delete finished, successful or not (closes the dialog)
 */
export function useAdministrationTasks(onSettledDelete?: () => void) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [updatingOwnerId, setUpdatingOwnerId] = useState<number | null>(null);
  const [taskFeedback, setTaskFeedback] = useState<{
    variant: "success" | "danger";
    message: string;
  } | null>(null);

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const taskMutation = useMutation({
    mutationFn: ({ ownerId, forceRefresh }: { ownerId: number; forceRefresh: boolean }) =>
      triggerAdministrationOwnerUpdate(ownerId, forceRefresh),
    onSuccess: (res) => {
      setTaskFeedback({
        variant: "success",
        message: res.message || t("Update task queued successfully."),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.AdministrationOwners });
      queryClient.invalidateQueries({ queryKey: queryKeys.UserCharacterStatuses });
    },
    onError: (err: unknown) => {
      setTaskFeedback({
        variant: "danger",
        message: errorMessage(err, t("Failed to trigger update task for owner.")),
      });
    },
    onSettled: () => {
      setUpdatingOwnerId(null);
    },
  });

  const globalQueueMutation = useMutation({
    mutationFn: ({
      target,
      forceRefresh,
    }: {
      target: "characters" | "corporations";
      forceRefresh: boolean;
    }) => triggerAdministrationGlobalUpdate({ target, forceRefresh }),
    onSuccess: (data) => {
      setTaskFeedback({
        variant: "success",
        message: data.message || t("Global update tasks queued successfully."),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.AdministrationOwners });
    },
    onError: (err: unknown) => {
      setTaskFeedback({
        variant: "danger",
        message: errorMessage(err, t("Failed to trigger global update tasks.")),
      });
    },
  });

  const deleteOwnerMutation = useMutation({
    mutationFn: (ownerId: number) => deleteAdministrationOwner(ownerId),
    onSuccess: (res) => {
      setTaskFeedback({
        variant: "success",
        message: res.message || t("Owner deleted successfully."),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.AdministrationOwners });
      queryClient.invalidateQueries({ queryKey: queryKeys.UserOwners });
      queryClient.invalidateQueries({ queryKey: queryKeys.PublicCatalogs });
      onSettledDelete?.();
    },
    onError: (err: unknown) => {
      setTaskFeedback({
        variant: "danger",
        message: errorMessage(err, t("Failed to delete owner.")),
      });
      onSettledDelete?.();
    },
  });

  const triggerOwnerUpdate = (ownerId: number, forceRefresh: boolean) => {
    setUpdatingOwnerId(ownerId);
    setTaskFeedback(null);
    taskMutation.mutate({ ownerId, forceRefresh });
  };

  return {
    taskFeedback,
    clearTaskFeedback: () => setTaskFeedback(null),
    updatingOwnerId,
    triggerOwnerUpdate,
    queueGlobalUpdate: globalQueueMutation.mutate,
    isQueuing: globalQueueMutation.isPending,
    deleteOwner: deleteOwnerMutation.mutate,
    isDeleting: deleteOwnerMutation.isPending,
  };
}
