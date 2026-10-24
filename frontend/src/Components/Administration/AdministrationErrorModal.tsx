// React
import React from "react";

// Third Party
import { useTranslation } from "react-i18next";

// AA bpforge
import { getEsiStatusBadgeClass } from "@/Components/Administration/esiStatus";
import { BaseModal } from "@/Components/Base/BaseModal";

/** Props of the modal that shows the full ESI error of an owner. */
export interface AdministrationErrorModalProps {
  show: boolean;
  onHide: () => void;
  ownerName: string;
  status: string;
  errorMessage?: string | null;
}

/**
 * Shows the full error message of an owner (opened by clicking the ESI status badge).
 * Falls back to a default text when the status is `token_error` without a message.
 */
export const AdministrationErrorModal: React.FC<AdministrationErrorModalProps> = ({
  show,
  onHide,
  ownerName,
  status,
  errorMessage,
}) => {
  const { t } = useTranslation();

  const message =
    errorMessage ||
    (status === "token_error"
      ? t("The ESI token is invalid or expired. Re-add the character or corporation.")
      : "");

  return (
    <BaseModal show={show} onHide={onHide} title={t("ESI Error Details")} size="lg">
      <p className="mb-2">
        <span className="fw-semibold">{ownerName}</span>{" "}
        <span className={`badge ${getEsiStatusBadgeClass(status)}`}>{status}</span>
      </p>
      <pre className="text-break mb-0">
        {message}
      </pre>
    </BaseModal>
  );
};
