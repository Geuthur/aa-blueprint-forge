// React
import React, { useState } from "react";

// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { Card } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import {
  loadUserOwners,
  loadUserSettings,
  updateOwnerSetting,
  updateUserSettings,
} from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import type { OwnerSettingSchema, UserSettingsSchema } from "@/Api/schema";
import { BpoSelectionModal } from "@/Components/Settings/BpoSelectionModal";
import { OwnerSettingsSection } from "@/Components/Settings/OwnerSettingsSection";
import { UserSettingsCard } from "@/Components/Settings/UserSettingsCard";
import styles from "@/Styles/modules/SettingsPage.module.css";

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeBpoModalOwner, setActiveBpoModalOwner] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const {
    data: settings,
    isLoading: isLoadingSettings,
    isError: isErrorSettings,
  } = useQuery({
    queryKey: queryKeys.UserSettings,
    queryFn: loadUserSettings,
  });

  const {
    data: owners,
    isLoading: isLoadingOwners,
    isError: isErrorOwners,
  } = useQuery({
    queryKey: queryKeys.UserOwners,
    queryFn: loadUserOwners,
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

  const updateOwnerMutation = useMutation({
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

  if (isLoadingSettings) {
    return (
      <div className="aa-loader-container">
        <span className="spinner-border" />
        <span>{t("Loading settings...")}</span>
      </div>
    );
  }

  if (isErrorSettings || !settings) {
    return (
      <Card className="bg-secondary text-light border-0 shadow-sm" role="alert">
        <Card.Body className={styles["error"]}>
          {t("Failed to load settings. Please try refreshing the page.")}
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className={`${styles["page"]}`}>
      <Card.Body className="bg-dark">
        {/* Page Header */}
        <Card.Header className={styles["header"] + " bg-secondary"}>
          <Settings2 size={24} aria-hidden="true" color="royalblue" />
          <div>
            <h1 className={styles["title"]}>{t("Settings")}</h1>
            <p className={styles["description"] + " text-light"}>
              {t(
                "Manage notifications and configure blueprint shop visibility for your linked characters and corporations.",
              )}
            </p>
          </div>
        </Card.Header>

        {/* User Notifications Card */}
        <UserSettingsCard
          disableNotifications={settings?.disable_notifications ?? false}
          isPending={updateMutation.isPending}
          isError={updateMutation.isError}
          onToggleNotifications={(checked) =>
            updateMutation.mutate({ disable_notifications: checked })
          }
        />

        {/* Character & Corporation Update Status Section */}
        <OwnerSettingsSection
          owners={owners}
          isLoading={isLoadingOwners}
          isError={isErrorOwners}
          isUpdating={updateOwnerMutation.isPending}
          updateError={updateOwnerMutation.isError}
          onUpdateOwner={(ownerId, payload) =>
            updateOwnerMutation.mutate({ ownerId, payload })
          }
          onOpenBpoModal={(targetOwner) => setActiveBpoModalOwner(targetOwner)}
        />

        {activeBpoModalOwner && (
          <BpoSelectionModal
            show={activeBpoModalOwner !== null}
            onHide={() => setActiveBpoModalOwner(null)}
            ownerId={activeBpoModalOwner.id}
            ownerName={activeBpoModalOwner.name}
          />
        )}
      </Card.Body>
    </Card>
  );
};

export default SettingsPage;