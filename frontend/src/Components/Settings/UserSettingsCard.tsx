// React
import React from "react";

// Third Party
import { BellOff } from "lucide-react";
import { Card } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import styles from "@/Styles/modules/SettingsPage.module.css";

interface UserSettingsCardProps {
  disableNotifications: boolean;
  isPending: boolean;
  isError: boolean;
  onToggleNotifications: (checked: boolean) => void;
}

export const UserSettingsCard: React.FC<UserSettingsCardProps> = ({
  disableNotifications,
  isPending,
  isError,
  onToggleNotifications,
}) => {
  const { t } = useTranslation();

  return (
    <Card className="bg-secondary text-light border-0 shadow-sm">
      <Card.Body className={styles["setting-row"]}>
        <div className={styles["setting-copy"]}>
          <div className={styles["setting-title"]}>
            <BellOff size={18} aria-hidden="true" />
            <label htmlFor="disable-notifications">{t("Disable all notifications")}</label>
          </div>
          <p className={styles["setting-description"]}>
            {t(
              "When enabled, Blueprint Shop will not send notifications to your Alliance Auth or Discord account.",
            )}
          </p>
          {isError && (
            <p className={styles["error-message"]} role="alert">
              {t("Could not save this setting. Your previous preference was restored.")}
            </p>
          )}
          {isPending && (
            <p className={styles["save-status"]} role="status">
              {t("Saving…")}
            </p>
          )}
        </div>
        <input
          id="disable-notifications"
          className={styles["switch"]}
          type="checkbox"
          role="switch"
          checked={disableNotifications}
          disabled={isPending}
          onChange={(event) => onToggleNotifications(event.currentTarget.checked)}
        />
      </Card.Body>
    </Card>
  );
};
