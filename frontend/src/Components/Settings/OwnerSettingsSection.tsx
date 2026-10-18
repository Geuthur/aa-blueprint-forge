// React
import React from "react";

// Third Party
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { OwnerSettingSchema, OwnerSettingUpdateRequest } from "@/Api/schema";
import { OwnerSettingCard } from "@/Components/Settings/OwnerSettingCard";
import styles from "@/Styles/modules/SettingsPage.module.css";

interface OwnerSettingsSectionProps {
  owners: OwnerSettingSchema[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isUpdating: boolean;
  updateError: boolean;
  onUpdateOwner: (ownerId: number, payload: OwnerSettingUpdateRequest) => void;
  onOpenBpoModal: (owner: { id: number; name: string }) => void;
}

export const OwnerSettingsSection: React.FC<OwnerSettingsSectionProps> = ({
  owners,
  isLoading,
  isError,
  isUpdating,
  updateError,
  onUpdateOwner,
  onOpenBpoModal,
}) => {
  const { t } = useTranslation();

  return (
    <section className={styles["section"]} aria-labelledby="char-status-heading">
      <header className={styles["section-header"]}>
        <div className={styles["section-title-wrap"]}>
          <Users size={20} aria-hidden="true" />
          <h2 id="char-status-heading" className={styles["section-title"]}>
            {t("Character & Corporation Status")}
          </h2>
          {owners && (
            <span className={styles["section-count"]}>({owners.length})</span>
          )}
        </div>
        <p className={styles["section-description"]}>
          {t(
            "ESI synchronization status and public visibility for your linked characters and corporations."
          )}
        </p>
      </header>

      {isLoading && (
        <div className="aa-loader-container">
          <span className="spinner-border" />
          <span>{t("Loading update statuses...")}</span>
        </div>
      )}

      {isError && (
        <div className={`aa-panel bg-dark text-danger ${styles["error"]}`} role="alert">
          {t("Failed to load character & corporation update status.")}
        </div>
      )}

      {updateError && (
        <p className={styles["error-message"]} role="alert">
          {t("Could not update shop visibility. Please try again.")}
        </p>
      )}

      {!isLoading && !isError && owners && owners.length === 0 && (
        <div className={`aa-panel bg-dark ${styles["empty-state"]}`}>
          {t(
            "No characters or corporations have been linked yet. Use the menu above to link your characters or corporations."
          )}
        </div>
      )}

      {!isLoading && !isError && owners && owners.length > 0 && (
        <div className={styles["characters-grid"]}>
          {owners.map((owner) => (
            <OwnerSettingCard
              key={owner.id}
              owner={owner}
              isUpdating={isUpdating}
              onUpdateOwner={onUpdateOwner}
              onOpenBpoModal={onOpenBpoModal}
            />
          ))}
        </div>
      )}
    </section>
  );
};
