// React
import React, { useState } from "react";

// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

// AA bpforge
import {
  loadSuperuserGroups,
  loadSuperuserOwnerBlueprints,
  loadSuperuserOwners,
  loadSuperuserSettings,
  triggerSuperuserOwnerUpdate,
  updateSuperuserOwner,
  updateSuperuserSettings,
} from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import type {
  OwnerSettingSchema,
  SuperuserOwnerUpdateRequest,
} from "@/Api/schema";
import { GlobalNotificationSettingsCard } from "@/Components/Superuser/GlobalNotificationSettingsCard";
import { SuperuserInspectionView } from "@/Components/Superuser/SuperuserInspectionView";
import { SuperuserOwnerModal } from "@/Components/Superuser/SuperuserOwnerModal";
import { SuperuserOwnersTable } from "@/Components/Superuser/SuperuserOwnersTable";

const SuperuserPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Queries
  const {
    data: groups,
    isLoading: isLoadingGroups,
  } = useQuery({
    queryKey: queryKeys.SuperuserGroups,
    queryFn: loadSuperuserGroups,
  });

  const {
    data: settings,
    isLoading: isLoadingSettings,
    isError: isErrorSettings,
  } = useQuery({
    queryKey: queryKeys.SuperuserSettings,
    queryFn: loadSuperuserSettings,
  });

  const {
    data: owners,
    isLoading: isLoadingOwners,
    isError: isErrorOwners,
  } = useQuery({
    queryKey: queryKeys.SuperuserOwners,
    queryFn: loadSuperuserOwners,
  });

  // Global settings state
  const [userCreatedGroupIds, setUserCreatedGroupIds] = useState<number[] | null>(null);
  const [userStatusGroupIds, setUserStatusGroupIds] = useState<number[] | null>(null);
  const [globalSavedSuccess, setGlobalSavedSuccess] = useState(false);
  const [globalErrorMsg, setGlobalErrorMsg] = useState<string | null>(null);

  const createdGroupIds = userCreatedGroupIds ?? (settings?.order_created_group_ids || []);
  const statusGroupIds = userStatusGroupIds ?? (settings?.order_status_group_ids || []);

  const handleToggleCreatedGroup = (groupId: number) => {
    setUserCreatedGroupIds((prev) => {
      const current = prev ?? (settings?.order_created_group_ids || []);
      if (current.includes(groupId)) {
        return current.filter((id) => id !== groupId);
      }
      return [...current, groupId];
    });
  };

  const handleToggleStatusGroup = (groupId: number) => {
    setUserStatusGroupIds((prev) => {
      const current = prev ?? (settings?.order_status_group_ids || []);
      if (current.includes(groupId)) {
        return current.filter((id) => id !== groupId);
      }
      return [...current, groupId];
    });
  };

  // Global settings mutation
  const globalMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateSuperuserSettings>[0]) =>
      updateSuperuserSettings(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.SuperuserSettings, updated);
      setUserCreatedGroupIds(null);
      setUserStatusGroupIds(null);
      setGlobalSavedSuccess(true);
      setGlobalErrorMsg(null);
      setTimeout(() => setGlobalSavedSuccess(false), 3000);
    },
    onError: (err: unknown) => {
      setGlobalErrorMsg(
        err instanceof Error ? err.message : t("Failed to update global notification settings.")
      );
      setGlobalSavedSuccess(false);
    },
  });

  const handleSaveGlobal = (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalErrorMsg(null);
    globalMutation.mutate({
      order_created_group_ids: createdGroupIds,
      order_status_group_ids: statusGroupIds,
    });
  };

  // Edit Owner Modal state
  const [editingOwner, setEditingOwner] = useState<OwnerSettingSchema | null>(null);
  const [ownerEditError, setOwnerEditError] = useState<string | null>(null);

  const openOwnerModal = (owner: OwnerSettingSchema) => {
    setEditingOwner(owner);
    setOwnerEditError(null);
  };

  const closeOwnerModal = () => {
    setEditingOwner(null);
    setOwnerEditError(null);
  };

  // Owner update mutation
  const ownerMutation = useMutation({
    mutationFn: ({ ownerId, payload }: { ownerId: number; payload: SuperuserOwnerUpdateRequest }) =>
      updateSuperuserOwner(ownerId, payload),
    onSuccess: (updatedOwner) => {
      queryClient.setQueryData<OwnerSettingSchema[]>(queryKeys.SuperuserOwners, (old) =>
        old?.map((o) => (o.id === updatedOwner.id ? updatedOwner : o))
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.UserOwners });
      queryClient.invalidateQueries({ queryKey: queryKeys.PublicCatalogs });
      closeOwnerModal();
    },
    onError: (err: unknown) => {
      setOwnerEditError(err instanceof Error ? err.message : t("Failed to update owner."));
    },
  });

  const handleSaveOwner = (payload: SuperuserOwnerUpdateRequest) => {
    if (!editingOwner) return;
    setOwnerEditError(null);
    ownerMutation.mutate({
      ownerId: editingOwner.id,
      payload,
    });
  };

  // Owner Task Update Mutation
  const [updatingOwnerId, setUpdatingOwnerId] = useState<number | null>(null);
  const [taskFeedback, setTaskFeedback] = useState<{
    variant: "success" | "danger";
    message: string;
  } | null>(null);

  const taskMutation = useMutation({
    mutationFn: ({ ownerId, forceRefresh }: { ownerId: number; forceRefresh: boolean }) =>
      triggerSuperuserOwnerUpdate(ownerId, forceRefresh),
    onSuccess: (res) => {
      setTaskFeedback({
        variant: "success",
        message: res.message || t("Update task queued successfully."),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.SuperuserOwners });
      queryClient.invalidateQueries({ queryKey: queryKeys.UserCharacterStatuses });
    },
    onError: (err: unknown) => {
      setTaskFeedback({
        variant: "danger",
        message:
          err instanceof Error
            ? err.message
            : t("Failed to trigger update task for owner."),
      });
    },
    onSettled: () => {
      setUpdatingOwnerId(null);
    },
  });

  const handleTriggerOwnerUpdate = (ownerId: number, forceRefresh: boolean) => {
    setUpdatingOwnerId(ownerId);
    setTaskFeedback(null);
    taskMutation.mutate({ ownerId, forceRefresh });
  };

  // Owner Blueprints Inspection state
  const [inspectingOwner, setInspectingOwner] = useState<OwnerSettingSchema | null>(null);

  const {
    data: ownerBlueprints = [],
    isLoading: isLoadingOwnerBlueprints,
    isError: isErrorOwnerBlueprints,
    refetch: refetchOwnerBlueprints,
  } = useQuery({
    queryKey: inspectingOwner
      ? queryKeys.SuperuserOwnerBlueprints(inspectingOwner.id)
      : ["none"],
    queryFn: () =>
      inspectingOwner
        ? loadSuperuserOwnerBlueprints(inspectingOwner.id)
        : Promise.resolve([]),
    enabled: Boolean(inspectingOwner),
  });

  if (inspectingOwner) {
    return (
      <SuperuserInspectionView
        inspectingOwner={inspectingOwner}
        ownerBlueprints={ownerBlueprints}
        isLoading={isLoadingOwnerBlueprints}
        isError={isErrorOwnerBlueprints}
        updatingOwnerId={updatingOwnerId}
        taskFeedback={taskFeedback}
        onDismissFeedback={() => setTaskFeedback(null)}
        onBack={() => setInspectingOwner(null)}
        onRefetch={() => refetchOwnerBlueprints()}
        onTriggerUpdate={handleTriggerOwnerUpdate}
      />
    );
  }

  return (
    <main className="bg-dark d-flex flex-column gap-3">
      <header className="d-flex align-items-center gap-3 mb-4">
        <div className="p-2 rounded bg-warning-subtle text-warning border border-warning-subtle">
          <ShieldAlert size={28} />
        </div>
        <div>
          <h1 className="h3 mb-1 fw-bold">{t("Superuser Administration")}</h1>
          <p className="mb-0 small">
            {t(
              "System-wide management of blueprint owners and configuration of Alliance Auth notification groups."
            )}
          </p>
        </div>
      </header>

      <GlobalNotificationSettingsCard
        groups={groups}
        isLoading={isLoadingSettings || isLoadingGroups}
        isError={isErrorSettings}
        createdGroupIds={createdGroupIds}
        statusGroupIds={statusGroupIds}
        isSaving={globalMutation.isPending}
        savedSuccess={globalSavedSuccess}
        errorMsg={globalErrorMsg}
        onToggleCreatedGroup={handleToggleCreatedGroup}
        onToggleStatusGroup={handleToggleStatusGroup}
        onSave={handleSaveGlobal}
        onDismissSuccess={() => setGlobalSavedSuccess(false)}
        onDismissError={() => setGlobalErrorMsg(null)}
      />

      <SuperuserOwnersTable
        owners={owners}
        isLoading={isLoadingOwners}
        isError={isErrorOwners}
        updatingOwnerId={updatingOwnerId}
        taskFeedback={taskFeedback}
        onDismissFeedback={() => setTaskFeedback(null)}
        onInspect={(owner) => setInspectingOwner(owner)}
        onEdit={(owner) => openOwnerModal(owner)}
        onTriggerUpdate={handleTriggerOwnerUpdate}
      />

      <SuperuserOwnerModal
        owner={editingOwner}
        groups={groups}
        isSaving={ownerMutation.isPending}
        errorMsg={ownerEditError}
        onClose={closeOwnerModal}
        onSave={handleSaveOwner}
        onDismissError={() => setOwnerEditError(null)}
      />
    </main>
  );
};

export default SuperuserPage;
