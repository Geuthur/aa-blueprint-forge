// React
import React from "react";

// Third Party
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Store,
  User,
} from "lucide-react";
import { Button, ButtonGroup } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { OwnerSettingSchema, OwnerSettingUpdateRequest } from "@/Api/schema";
import styles from "@/Styles/modules/SettingsPage.module.css";
import { renderTooltip } from "@/Utils";
import { imageServer } from "@/Utils/eveOnline";

interface OwnerSettingCardProps {
  owner: OwnerSettingSchema;
  isUpdating: boolean;
  onUpdateOwner: (ownerId: number, payload: OwnerSettingUpdateRequest) => void;
  onOpenBpoModal: (owner: { id: number; name: string }) => void;
}

export const OwnerSettingCard: React.FC<OwnerSettingCardProps> = ({
  owner,
  isUpdating,
  onUpdateOwner,
  onOpenBpoModal,
}) => {
  const { t } = useTranslation();

  const status = (owner.status || "incomplete").toLowerCase();
  const isError = status === "error";
  const isTokenError = status === "token_error";
  const cardClass = isError
    ? styles["char-card-error"]
    : isTokenError
      ? styles["char-card-warning"]
      : "";

  const avatarUrl =
    owner.portrait_url ||
    (owner.is_corporation && owner.corporation_id
      ? imageServer("corporations", owner.corporation_id, 64)
      : owner.character_id
        ? imageServer("characters", owner.character_id, 64)
        : null);

  const renderStatusBadge = () => {
    const isOk = status === "ok";
    const isDisabled = status === "disabled";

    let badgeClass = styles["badge-incomplete"];
    let label = t("Incomplete");
    let Icon = AlertTriangle;

    if (isOk) {
      badgeClass = styles["badge-ok"];
      label = t("OK");
      Icon = CheckCircle2;
    } else if (isError) {
      badgeClass = styles["badge-error"];
      label = t("Error");
      Icon = AlertCircle;
    } else if (isTokenError) {
      badgeClass = styles["badge-token-error"];
      label = t("Token Error");
      Icon = AlertTriangle;
    } else if (isDisabled) {
      badgeClass = styles["badge-disabled"];
      label = t("Disabled");
      Icon = AlertCircle;
    }

    return (
      <span className={`${styles["status-badge"]} ${badgeClass}`}>
        {(isError || isTokenError) && (
          <span className="aa-pending-dot-container me-1" aria-hidden="true">
            <span className={isError ? "aa-danger-dot-ping" : "aa-pending-dot-ping"} />
            <span className={isError ? "aa-danger-dot-core" : "aa-pending-dot-core"} />
          </span>
        )}
        <Icon size={12} aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <article className={`bg-dark ${styles["char-card"]} ${cardClass}`}>
      <div className={styles["char-header"]}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={owner.name}
            className={`${styles["portrait"]} ${owner.is_corporation ? styles["portrait-corp"] : ""
              }`}
          />
        ) : (
          <div
            className={`${styles["portrait"]} d-flex align-items-center justify-content-center bg-secondary text-light`}
          >
            {owner.is_corporation ? <Building2 size={24} /> : <User size={24} />}
          </div>
        )}
        <div className={styles["char-info"]}>
          <div className="d-flex align-items-center justify-content-between gap-2">
            {renderTooltip(
              owner.name,
              <h3 className={styles["char-name"]}>
                {owner.name}
              </h3>
            )}
            {owner.is_corporation ? (
              <span className="badge bg-info-subtle text-info border border-info-subtle d-inline-flex align-items-center gap-1 flex-shrink-0">
                <Building2 size={11} />
                {t("Corporation")}
              </span>
            ) : (
              <span className="badge bg-warning-subtle text-warning border border-warning-subtle d-inline-flex align-items-center gap-1 flex-shrink-0">
                <User size={11} />
                {t("Character")}
              </span>
            )}
          </div>
          <p className={styles["char-corp"]}>
            {owner.is_corporation
              ? (owner.corporation_ticker ? `[${owner.corporation_ticker}]` : t("Corporation"))
              : (owner.corporation_name
                ? `${owner.corporation_name} [${owner.corporation_ticker || ""}]`
                : "")}
          </p>
          <div className={styles["owner-stats"]}>
            <span>
              {t("{{count}} Blueprints", { count: owner.blueprint_count })}
            </span>
            <span>•</span>
            <span>{owner.bpo_count} BPO</span>
            <span>•</span>
            <span>{owner.bpc_count} BPC</span>
          </div>
        </div>
      </div>

      {owner.error_message && (
        <div className={styles["error-banner"]} role="alert">
          {owner.error_message}
        </div>
      )}

      {owner.sections && owner.sections.length > 0 && (
        <div className={styles["sections-list"]}>
          {owner.sections.map((sec) => {
            let dotClass = styles["dot-muted"];
            if (sec.is_success === true) dotClass = styles["dot-ok"];
            else if (sec.is_success === false) dotClass = styles["dot-error"];
            else if (sec.has_token_error) dotClass = styles["dot-warning"];

            return (
              <div key={sec.section} className={styles["section-item"]}>
                <span className="d-inline-flex align-items-center gap-2">
                  <span
                    className={`${styles["section-dot"]} ${dotClass}`}
                    aria-hidden="true"
                  />
                  <span>{sec.section_name}</span>
                </span>
                <span>
                  {sec.has_token_error
                    ? t("Token Error")
                    : sec.is_success === true
                      ? t("OK")
                      : sec.is_success === false
                        ? t("Failed")
                        : t("Pending")}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Clickable Public Row */}
      {renderTooltip(
        t("Toggle public shop visibility"),
        <div
          className={`${styles["public-row"]} border rounded bg-secondary`}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (!isUpdating) {
              onUpdateOwner(owner.id, { is_public: !owner.is_public });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!isUpdating) {
                onUpdateOwner(owner.id, { is_public: !owner.is_public });
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
            disabled={isUpdating}
            aria-label={t("Toggle public shop for {{name}}", { name: owner.name })}
            onChange={(e) => {
              e.stopPropagation();
              onUpdateOwner(owner.id, { is_public: e.currentTarget.checked });
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Catalog & Selective BPO Controls (visible when public) */}
      {owner.is_public && (
        <div className="d-flex flex-column gap-2 mt-2">
          <ButtonGroup size="sm" className="w-100">
            <Button
              variant="secondary"
              size="sm"
              className={`${styles.settingsTypeBtn} bg-secondary text-light border border-secondary ${(!owner.public_type || owner.public_type === "all")
                ? "border-light shadow fw-bold"
                : "opacity-75"
                }`}
              disabled={isUpdating}
              onClick={() => {
                if (!isUpdating && owner.public_type !== "all") {
                  onUpdateOwner(owner.id, { public_type: "all" });
                }
              }}
            >
              {t("All")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className={`${styles.settingsTypeBtn} bg-primary text-light border border-primary ${owner.public_type === "bpo"
                ? "border-light shadow fw-bold"
                : "opacity-75"
                }`}
              disabled={isUpdating}
              onClick={() => {
                if (!isUpdating && owner.public_type !== "bpo") {
                  onUpdateOwner(owner.id, { public_type: "bpo" });
                }
              }}
            >
              {t("BPO Only")}
            </Button>
            <Button
              variant="info"
              size="sm"
              className={`${styles.settingsTypeBtn} bg-info border border-info ${owner.public_type === "bpc"
                ? "border-dark shadow fw-bold"
                : "opacity-75"
                }`}
              disabled={isUpdating}
              onClick={() => {
                if (!isUpdating && owner.public_type !== "bpc") {
                  onUpdateOwner(owner.id, { public_type: "bpc" });
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
                      onOpenBpoModal({ id: owner.id, name: owner.name })
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
                    disabled={isUpdating}
                    onChange={(e) => {
                      onUpdateOwner(owner.id, {
                        selective_bpo_enabled: e.currentTarget.checked,
                      });
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles["badge-row"]}>
        {renderStatusBadge()}
        {owner.last_sync ? (
          renderTooltip(
            `${t("Last sync")}: ${owner.last_sync}`,
            <span className={styles["last-sync"]}>
              <Clock size={12} aria-hidden="true" />
              <span>{owner.last_sync.slice(5)}</span>
            </span>
          )
        ) : (
          <span className={styles["last-sync"]}>
            <Clock size={12} aria-hidden="true" />
            <span>{t("Never")}</span>
          </span>
        )}
      </div>
    </article>
  );
};
