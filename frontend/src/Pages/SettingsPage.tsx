// React
import React, { useState } from "react";

// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2, Users } from "lucide-react";
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
import { OwnerSettingCard } from "@/Components/Settings/OwnerSettingCard";
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
      <div className={`aa-panel ${styles["error"]}`} role="alert">
        {t("Failed to load settings. Please try refreshing the page.")}
      </div>
    );
  }

  return (
    <main className={`aa-panel-light ${styles["page"]}`}>
      <header className={styles["header"]}>
        <Settings2 size={24} aria-hidden="true" />
        <div>
          <h1 className={styles["title"]}>{t("Settings")}</h1>
          <p className={styles["description"]}>
            {t("Manage your blueprint preferences and owner visibility.")}
          </p>
        </div>
      </header>

      {/* Notifications Section */}
      <UserSettingsCard
        disableNotifications={settings.disable_notifications}
        isPending={updateMutation.isPending}
        isError={updateMutation.isError}
        onToggleNotifications={(checked) =>
          updateMutation.mutate({ disable_notifications: checked })
        }
      />

      {/* Character & Corporation Update Status Section */}
      <section className={styles["section"]} aria-labelledby="char-status-heading">
        <header className={styles["section-header"]}>
          <div className={styles["section-title-wrap"]}>
            <Users size={20} aria-hidden="true" />
            <h2 id="char-status-heading" className={styles["section-title"]}>
              {t("Character & Corporation Status")}
            </h2>
            {owners && (
              <span className={styles["section-count"]}>
                ({owners.length})
              </span>
            )}
          </div>
          <p className={styles["section-description"]}>
            {t(
              "ESI synchronization status and public visibility for your linked characters and corporations.",
            )}
          </p>
        </header>

        {isLoadingOwners && (
          <div className="aa-loader-container">
            <span className="spinner-border" />
            <span>{t("Loading update statuses...")}</span>
          </div>
        )}

        {isErrorOwners && (
          <div className={`aa-panel ${styles["error"]}`} role="alert">
            {t("Failed to load character & corporation update status.")}
          </div>
        )}

        {updateOwnerMutation.isError && (
          <p className={styles["error-message"]} role="alert">
            {t("Could not update shop visibility. Please try again.")}
          </p>
        )}

        {!isLoadingOwners && !isErrorOwners && owners && owners.length === 0 && (
          <div className={`aa-panel ${styles["empty-state"]}`}>
            {t(
              "No characters or corporations have been linked yet. Use the menu above to link your characters or corporations.",
            )}
          </div>
        )}

        {!isLoadingOwners && !isErrorOwners && owners && owners.length > 0 && (
          <div className={styles["characters-grid"]}>
            {owners.map((owner) => (
              <OwnerSettingCard
                key={owner.id}
                owner={owner}
                isUpdating={updateOwnerMutation.isPending}
                onUpdateOwner={(ownerId, payload) =>
                  updateOwnerMutation.mutate({ ownerId, payload })
                }
                onOpenBpoModal={(targetOwner) => setActiveBpoModalOwner(targetOwner)}
              />
            ))}
          </div>
        )}
      </section>

      {activeBpoModalOwner && (
        <BpoSelectionModal
          show={activeBpoModalOwner !== null}
          onHide={() => setActiveBpoModalOwner(null)}
          ownerId={activeBpoModalOwner.id}
          ownerName={activeBpoModalOwner.name}
        />
      )}
    </main>
  );
};

export default SettingsPage;