// React
import React, { useMemo, useState } from "react";

// Third Party
import { Settings2, Store, Users } from "lucide-react";
import { Button, ButtonGroup, Card } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import { BaseOwnerSettingsSection } from "@/Components/Base/OwnerSettings";
import type { BaseOwner } from "@/Components/Base/OwnerSettings/types";
import { BpoSelectionModal } from "@/Components/Settings/BpoSelectionModal";
import {
  useOwnerActions,
  useUpdateOwnerSetting,
  useUserOwners,
  useUserSettings,
} from "@/Components/Settings/Hooks";
import { UserSettingsCard } from "@/Components/Settings/UserSettingsCard";
import styles from "@/Styles/modules/SettingsPage.module.css";
import { renderTooltip } from "@/Utils";
import { imageServer } from "@/Utils/eveOnline";

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();

  const [activeBpoModalOwner, setActiveBpoModalOwner] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const {
    data: settings,
    isLoading: isLoadingSettings,
    isError: isErrorSettings,
    updateMutation,
  } = useUserSettings();
  const { data: owners, isLoading: isLoadingOwners, isError: isErrorOwners } = useUserOwners();
  const updateOwnerMutation = useUpdateOwnerSetting();
  const actions = useOwnerActions();

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
        <div className={`d-flex align-items-center flex-wrap gap-2 mt-1 text-light ${styles.textXs}`}>
          <span>{t("{{count}} Blueprints", { count: owner.blueprint_count })}</span>
          <span>•</span>
          <span>{owner.bpo_count} BPO</span>
          <span>•</span>
          <span>{owner.bpc_count} BPC</span>
        </div>

        {renderTooltip(
          t("Toggle public shop visibility"),
          <div
            className="d-flex align-items-center justify-content-between gap-2 px-3 py-2 mt-1 border rounded bg-secondary user-select-none"
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
              <span className="small fw-semibold">
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
                className={`flex-fill fw-semibold ${styles.settingsTypeBtn} bg-secondary text-light border border-secondary ${
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
                className={`flex-fill fw-semibold ${styles.settingsTypeBtn} bg-primary text-light border border-primary ${
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
                className={`flex-fill fw-semibold ${styles.settingsTypeBtn} bg-info border border-info ${
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
              <div className="card-body border d-flex align-items-center justify-content-between gap-2 p-2">
                <div className="d-flex flex-column">
                  <span className="small fw-medium">
                    {t("Selective BPOs")}
                  </span>
                  <span className={`text-muted ${styles.textXs}`}>
                    {owner.selective_bpo_enabled
                      ? t("Only chosen BPOs are offered")
                      : t("All BPOs are offered")}
                  </span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  {owner.selective_bpo_enabled && (
                    <Button
                      variant="primary"
                      size="sm"
                      type="button"
                      className="fw-semibold"
                      onClick={() =>
                        setActiveBpoModalOwner({ id: owner.id, name: owner.name })
                      }
                    >
                      {t("Select BPOs…")}
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
        <span>{t("Loading settings…")}</span>
      </div>
    );
  }

  if (isErrorSettings || !settings) {
    return (
      <Card className="bg-secondary text-light border-0 shadow-sm" role="alert">
        <Card.Body className="text-danger">
          {t("Failed to load settings. Please try refreshing the page.")}
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className={`${styles.page} mx-auto`}>
      <Card.Body className="bg-dark">
        {/* Page Header */}
        <Card.Header className="d-flex align-items-center gap-3 mb-4 bg-secondary">
          <Settings2 size={24} aria-hidden="true" color="royalblue" />
          <div>
            <h1 className={`m-0 fs-4 fw-bold ${styles.title}`}>{t("Settings")}</h1>
            <p className="mt-1 mb-0 small text-light">
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
          onUpdateAll={actions.updateAll}
          isUpdatingAll={actions.isUpdatingAll}
          globalCooldown={actions.globalCooldown}
          feedbackMessage={actions.feedback}
          onDismissFeedback={actions.clearFeedback}
          onTriggerSingleUpdate={actions.updateOwner}
          updatingOwnerId={actions.updatingOwnerId}
          ownerCooldowns={actions.ownerCooldowns}
          onDeleteOwner={(owner) => actions.deleteOwner(owner.id)}
          isDeleting={actions.isDeleting}
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