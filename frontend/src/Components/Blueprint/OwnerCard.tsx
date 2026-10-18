// React
import React from "react";

// Third Party
import { ShoppingBag, Box, Layers, Building2, User } from "lucide-react";
import { Card, Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { components } from "@/Api/OpenApi";
import styles from "@/Styles/modules/Blueprint.module.css";
import { renderTooltip } from "@/Utils";
import { imageServer } from "@/Utils/eveOnline";

type PublicOwner = components["schemas"]["OwnerPublicSchema"];

interface OwnerCardProps {
  owner: PublicOwner;
  onSelect: (owner: PublicOwner, initialType?: "bpo" | "bpc") => void;
}

export const OwnerCard: React.FC<OwnerCardProps> = ({ owner, onSelect }) => {
  const { t } = useTranslation();

  const avatarUrl = owner.is_corporation && owner.corporation_id
    ? imageServer("corporations", owner.corporation_id, 128)
    : owner.character_id
      ? imageServer("characters", owner.character_id, 128)
      : null;

  return (
    <Card className="aa-panel h-100 shadow-sm border-0 d-flex flex-column justify-content-between">
      <Card.Body className="p-3">
        <div className="d-flex align-items-center gap-3 mb-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={owner.name}
              width={54}
              height={54}
              className={`rounded ${owner.is_corporation ? "" : "rounded-circle"} border border-secondary shadow-sm`}
            />
          ) : (
            <div
              className={`rounded d-flex align-items-center justify-content-center bg-secondary text-light ${styles.ownerCardAvatar}`}
            >
              <ShoppingBag size={24} />
            </div>
          )}
          <div className="overflow-hidden">
            {renderTooltip(
              owner.name,
              <h5 className="mb-1 text-truncate text-light fw-bold">
                {owner.name}
              </h5>
            )}
            <div className="d-flex align-items-center gap-1 text-secondary small">
              {owner.is_corporation ? (
                <>
                  <Building2 size={14} className="text-info" />
                  <span>{t("Corporation Blueprints")}</span>
                </>
              ) : (
                <>
                  <User size={14} className="text-warning" />
                  <span>{t("Personal Blueprints")}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="row g-2 text-center my-2">
          <div className="col-4">
            {renderTooltip(
              t("Browse all blueprints"),
              <div
                aria-label={t("Browse all blueprints")}
                className={`p-2 rounded bg-secondary text-light border border-secondary ${styles.clickable}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(owner)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(owner);
                }}
              >
                <div className="small d-flex align-items-center justify-content-center gap-1 opacity-75">
                  <Box size={13} />
                  <span>{t("Total")}</span>
                </div>
                <span className="fw-bold fs-6">{owner.blueprint_count}</span>
              </div>
            )}
          </div>
          <div className="col-4">
            {renderTooltip(
              t("Browse only Originals (BPO)"),
              <div
                aria-label={t("Browse only Originals (BPO)")}
                className={`p-2 rounded bg-primary text-light border border-primary ${styles.clickable}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(owner, "bpo")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(owner, "bpo");
                }}
              >
                <div className="small d-flex align-items-center justify-content-center gap-1 opacity-75">
                  <Layers size={13} />
                  <span>{t("BPO")}</span>
                </div>
                <span className="fw-bold fs-6">{owner.bpo_count}</span>
              </div>
            )}
          </div>
          <div className="col-4">
            {renderTooltip(
              t("Browse only Copies (BPC)"),
              <div
                aria-label={t("Browse only Copies (BPC)")}
                className={`p-2 rounded bg-info text-dark border border-info ${styles.clickable}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(owner, "bpc")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(owner, "bpc");
                }}
              >
                <div className="small d-flex align-items-center justify-content-center gap-1 opacity-75">
                  <Layers size={13} />
                  <span>{t("BPC")}</span>
                </div>
                <span className="fw-bold fs-6">{owner.bpc_count}</span>
              </div>
            )}
          </div>
        </div>
      </Card.Body>

      <Card.Footer className="bg-transparent border-0 p-3 pt-0">
        <Button
          variant="primary"
          className="w-100 d-flex align-items-center justify-content-center gap-2 aa-btn aa-btn-primary"
          onClick={() => onSelect(owner)}
        >
          <ShoppingBag size={16} />
          {t("Browse Blueprints")}
        </Button>
      </Card.Footer>
    </Card>
  );
};
