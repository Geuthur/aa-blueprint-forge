// React
import React, { useEffect, useMemo, useState } from "react";

// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2, Store, Users } from "lucide-react";
import { Button, ButtonGroup, Card } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import {
  deleteOwner,
  loadUserOwners,
  loadUserSettings,
  triggerOwnerUpdate,
  triggerUpdateAllUserOwners,
  updateOwnerSetting,
  updateUserSettings,
} from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import type { OwnerSettingSchema, UserSettingsSchema } from "@/Api/schema";
import { BaseOwnerSettingsSection } from "@/Components/Base/OwnerSettings";
import type { BaseOwner } from "@/Components/Base/OwnerSettings/types";
import { BpoSelectionModal } from "@/Components/Settings/BpoSelectionModal";
import { UserSettingsCard } from "@/Components/Settings/UserSettingsCard";
import styles from "@/Styles/modules/SettingsPage.module.css";
import { renderTooltip } from "@/Utils";
import { imageServer } from "@/Utils/eveOnline";

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeBpoModalOwner, setActiveBpoModalOwner] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // Cooldown & Feedback States
  const [globalCooldown, setGlobalCooldown] = useState(0);
  const [updatingOwnerId, setUpdatingOwnerId] = useState<number | null>(null);
  const [ownerCooldowns, setOwnerCooldowns] = useState<Record<number, number>>({});
  const [feedbackMsg, setFeedbackMsg] = useState<{ variant: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    if (globalCooldown <= 0) return;
    const timer = setInterval(() => {
      setGlobalCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [globalCooldown]);

  useEffect(() => {
    const activeCooldowns = Object.values(ownerCooldowns).some((v) => v > 0);
    if (!activeCooldowns) return;
    const timer = setInterval(() => {
      setOwnerCooldowns((prev) => {
        const next: Record<number, number> = {};
        for (const [key, val] of Object.entries(prev)) {
          if (val > 1) next[Number(key)] = val - 1;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [ownerCooldowns]);

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

  const invalidateOwnerQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.UserOwners });
    queryClient.invalidateQueries({ queryKey: queryKeys.UserCharacterStatuses });
    queryClient.invalidateQueries({ queryKey: queryKeys.PublicCatalogs });
  };

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

  // Global Update All Mutation
  const updateAllMutation = useMutation({
    mutationFn: () => triggerUpdateAllUserOwners(false),
    onSuccess: (res) => {
      setFeedbackMsg({ variant: "success", text: res.message || t("Update tasks queued successfully.") });
      setGlobalCooldown(60);
      invalidateOwnerQueries();
      setTimeout(() => setFeedbackMsg(null), 5000);
    },
    onError: (err: unknown) => {
      setFeedbackMsg({
        variant: "danger",
        text: err instanceof Error ? err.message : t("Failed to trigger update all tasks."),
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    },
  });

  // Single Owner Update Mutation
  const updateSingleMutation = useMutation({
    mutationFn: (ownerId: number) => triggerOwnerUpdate(ownerId, false),
    onSuccess: (res, ownerId) => {
      setFeedbackMsg({ variant: "success", text: res.message || t("Update task queued successfully.") });
      setOwnerCooldowns((prev) => ({ ...prev, [ownerId]: 60 }));
      invalidateOwnerQueries();
      setTimeout(() => setFeedbackMsg(null), 5000);
    },
    onError: (err: unknown) => {
      setFeedbackMsg({
        variant: "danger",
        text: err instanceof Error ? err.message : t("Failed to trigger owner update task."),
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    },
    onSettled: () => {
      setUpdatingOwnerId(null);
    },
  });

  const handleTriggerSingleUpdate = (ownerId: number) => {
    setUpdatingOwnerId(ownerId);
    updateSingleMutation.mutate(ownerId);
  };

  // Delete Owner Mutation
  const deleteMutation = useMutation({
    mutationFn: (ownerId: number) => deleteOwner(ownerId),
    onSuccess: (res) => {
      setFeedbackMsg({ variant: "success", text: res.message || t("Owner deleted successfully.") });
      invalidateOwnerQueries();
      setTimeout(() => setFeedbackMsg(null), 5000);
    },
    onError: (err: unknown) => {
      setFeedbackMsg({
        variant: "danger",
        text: err instanceof Error ? err.message : t("Failed to delete owner."),
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    },
  });

  const mappedOwners: BaseOwner[] = useMemo(() => {
    if (!owners) return [];
    return owners.map((owner) => {
      const avatarUrl =
        owner.portrait_url ||
        (owner.is_corporation && owner.corporation_id
          ? imageServer("corporations", owner.corporation_id, 64)
          : owner.character_id
            ? imageServer("characters", owner.character_id, 64)
            : null);

      const subtitle = owner.is_corporation
        ? (owner.corporation_ticker ? `[${owner.corporation_ticker}]` : t("Corporation"))
        : (owner.corporation_name
          ? `${owner.corporation_name} [${owner.corporation_ticker || ""}]`
          : "");

      return {
        id: owner.id,
        name: owner.name,
        owner_type: owner.is_corporation ? "corporation" : "character",
        avatar_url: avatarUrl,
        subtitle: subtitle,
        status: owner.status,
        has_error: owner.has_error,
        error_message: owner.error_message,
        last_sync: owner.last_sync,
        sections: owner.sections,
      };
    });
  }, [owners, t]);

  const renderCustomCardContent = (baseOwner: BaseOwner) => {
    const owner = owners?.find((o) => o.id === baseOwner.id);
    if (!owner) return null;

    return (
      <div className="d-flex flex-column gap-2">
        <div className={styles["owner-stats"]}>
          <span>{t("{{count}} Blueprints", { count: owner.blueprint_count })}</span>
          <span>•</span>
          <span>{owner.bpo_count} BPO</span>
          <span>•</span>
          <span>{owner.bpc_count} BPC</span>
        </div>

        {renderTooltip(
          t("Toggle public shop visibility"),
          <div
            className={`${styles["public-row"]} border rounded bg-secondary`}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!updateOwnerMutation.isPending) {
                updateOwnerMutation.mutate({
                  ownerId: owner.id,
                  payload: { is_public: !owner.is_public },
                });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!updateOwnerMutation.isPending) {
                  updateOwnerMutation.mutate({
                    ownerId: owner.id,
                    payload: { is_public: !owner.is_public },
                  });
                }
              }
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <Store
                size={16}
                className={owner.is_public ? "text-success" : "text-light"}
              />
              <span className={styles["public-label"]}>
                {t("Public Shop")}
              </span>
            </div>
            <input
              type="checkbox"
              role="switch"
              className={styles["switch"]}
              checked={owner.is_public}
              disabled={updateOwnerMutation.isPending}
              aria-label={t("Toggle public shop for {{name}}", { name: owner.name })}
              onChange={(e) => {
                e.stopPropagation();
                updateOwnerMutation.mutate({
                  ownerId: owner.id,
                  payload: { is_public: e.currentTarget.checked },
                });
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {owner.is_public && (
          <div className="d-flex flex-column gap-2 mt-1">
            <ButtonGroup size="sm" className="w-100">
              <Button
                variant="secondary"
                size="sm"
                className={`${styles.settingsTypeBtn} bg-secondary text-light border border-secondary ${
                  !owner.public_type || owner.public_type === "all"
                    ? "border-light shadow fw-bold"
                    : "opacity-75"
                }`}
                disabled={updateOwnerMutation.isPending}
                onClick={() => {
                  if (!updateOwnerMutation.isPending && owner.public_type !== "all") {
                    updateOwnerMutation.mutate({
                      ownerId: owner.id,
                      payload: { public_type: "all" },
                    });
                  }
                }}
              >
                {t("All")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                className={`${styles.settingsTypeBtn} bg-primary text-light border border-primary ${
                  owner.public_type === "bpo"
                    ? "border-light shadow fw-bold"
                    : "opacity-75"
                }`}
                disabled={updateOwnerMutation.isPending}
                onClick={() => {
                  if (!updateOwnerMutation.isPending && owner.public_type !== "bpo") {
                    updateOwnerMutation.mutate({
                      ownerId: owner.id,
                      payload: { public_type: "bpo" },
                    });
                  }
                }}
              >
                {t("BPO Only")}
              </Button>
              <Button
                variant="info"
                size="sm"
                className={`${styles.settingsTypeBtn} bg-info border border-info ${
                  owner.public_type === "bpc"
                    ? "border-dark shadow fw-bold"
                    : "opacity-75"
                }`}
                disabled={updateOwnerMutation.isPending}
                onClick={() => {
                  if (!updateOwnerMutation.isPending && owner.public_type !== "bpc") {
                    updateOwnerMutation.mutate({
                      ownerId: owner.id,
                      payload: { public_type: "bpc" },
                    });
                  }
                }}
              >
                {t("BPC Only")}
              </Button>
            </ButtonGroup>

            {owner.public_type !== "bpc" && (
              <div className={`card-body border ${styles["selective-row"]}`}>
                <div className="d-flex flex-column">
                  <span className="small fw-medium">
                    {t("Selective BPOs")}
                  </span>
                  <span className={`text-muted ${styles.selectiveSubtext}`}>
                    {owner.selective_bpo_enabled
                      ? t("Only chosen BPOs are offered")
                      : t("All BPOs are offered")}
                  </span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  {owner.selective_bpo_enabled && (
                    <Button
                      variant="primary"
                      type="button"
                      className={`aa-btn aa-btn-primary btn btn-sm ${styles["bpo-btn"]}`}
                      onClick={() =>
                        setActiveBpoModalOwner({ id: owner.id, name: owner.name })
                      }
                    >
                      {t("Select BPOs...")}
                    </Button>
                  )}
                  {renderTooltip(
                    t("Toggle selective BPOs"),
                    <input
                      type="checkbox"
                      role="switch"
                      className={styles["switch"]}
                      checked={Boolean(owner.selective_bpo_enabled)}
                      disabled={updateOwnerMutation.isPending}
                      onChange={(e) => {
                        updateOwnerMutation.mutate({
                          ownerId: owner.id,
                          payload: {
                            selective_bpo_enabled: e.currentTarget.checked,
                          },
                        });
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

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

        {/* Character & Corporation Status Section */}
        <BaseOwnerSettingsSection<BaseOwner>
          title={t("Character & Corporation Status")}
          description={t(
            "ESI synchronization status and public visibility for your linked characters and corporations.",
          )}
          icon={<Users size={20} aria-hidden="true" color="royalblue" />}
          owners={mappedOwners}
          isLoading={isLoadingOwners}
          isError={isErrorOwners}
          errorMessage={t("Failed to load character & corporation update status.")}
          emptyMessage={t(
            "No characters or corporations have been linked yet. Use the menu above to link your characters or corporations.",
          )}
          appName="Blueprint Forge"
          onUpdateAll={() => updateAllMutation.mutate()}
          isUpdatingAll={updateAllMutation.isPending}
          globalCooldown={globalCooldown}
          feedbackMessage={feedbackMsg}
          onDismissFeedback={() => setFeedbackMsg(null)}
          onTriggerSingleUpdate={handleTriggerSingleUpdate}
          updatingOwnerId={updatingOwnerId}
          ownerCooldowns={ownerCooldowns}
          onDeleteOwner={(owner) => deleteMutation.mutateAsync(owner.id)}
          isDeleting={deleteMutation.isPending}
          deleteModalTitle={t("Delete Owner")}
          deleteModalDescription={() =>
            t(
              "This will remove this owner from Blueprint Forge along with all associated blueprints and configurations. This action cannot be undone.",
            )
          }
          renderCustomCardContent={renderCustomCardContent}
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