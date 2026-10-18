// React
import React, { useState } from "react";

// Third Party
import { ShoppingCart, Send, Trash2, AlertCircle } from "lucide-react";
import { Button, Form, Table, Badge, Alert, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import { BaseModal } from "@/Components/Base/BaseModal";
import type { BlueprintItem } from "@/Components/Blueprint/BlueprintTableColumns";
import styles from "@/Styles/modules/Blueprint.module.css";
import { renderTooltip } from "@/Utils";
import { imageServer } from "@/Utils/eveOnline";

export interface CartItem {
  blueprint: BlueprintItem;
  quantity: number;
  runs: number | null;
}

interface OrderModalProps {
  show: boolean;
  onHide: () => void;
  shopName: string;
  items: CartItem[];
  onUpdateQuantity: (blueprintId: number, quantity: number) => void;
  onUpdateRuns: (blueprintId: number, runs: number | null) => void;
  onRemoveItem: (blueprintId: number) => void;
  onSubmitOrder: (note: string) => Promise<void>;
  isSubmitting?: boolean;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  show,
  onHide,
  shopName,
  items,
  onUpdateQuantity,
  onUpdateRuns,
  onRemoveItem,
  onSubmitOrder,
  isSubmitting = false,
}) => {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (items.length === 0) {
      setErrorMsg(t("Please select at least one blueprint."));
      return;
    }
    setErrorMsg(null);
    try {
      await onSubmitOrder(note);
      setNote("");
      onHide();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t("Failed to submit order."));
    }
  };

  const footer = (
    <div className="d-flex justify-content-end gap-2 w-100">
      <Button
        variant="secondary"
        className="aa-btn aa-btn-secondary"
        onClick={onHide}
        disabled={isSubmitting}
      >
        {t("Cancel")}
      </Button>
      <Button
        variant="primary"
        className="aa-btn aa-btn-primary d-flex align-items-center gap-2"
        onClick={() => handleSubmit()}
        disabled={items.length === 0 || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Spinner size="sm" animation="border" className="me-1" />
            {t("Submitting...")}
          </>
        ) : (
          <>
            <Send size={16} />
            {t("Confirm & Place Order")}
          </>
        )}
      </Button>
    </div>
  );

  return (
    <BaseModal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      backdrop="static"
      title={
        <div className="d-flex align-items-center gap-2 fs-5">
          <ShoppingCart size={20} className="text-primary" />
          <span>{t("Submit Order to {{ownerName}}", { ownerName: shopName, shopName })}</span>
        </div>
      }
      footer={footer}
    >
      <div className="aa-panel p-3">
        {errorMsg && (
          <Alert variant="danger" className="d-flex align-items-center gap-2 mb-3">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </Alert>
        )}

        <p className="text-secondary small mb-3">
          {t("Review your selected blueprint items below. You can configure requested copies and runs before confirming.")}
        </p>

        <div className="table-responsive border border-secondary rounded mb-3">
          <Table variant="dark" hover className="align-middle mb-0">
            <thead className="table-secondary text-dark">
              <tr>
                <th>{t("Blueprint")}</th>
                <th>{t("Type")}</th>
                <th className={styles.orderModalQtyCol}>{t("Quantity")}</th>
                <th className={styles.orderModalQtyCol}>{t("Runs")}</th>
                <th className={styles.orderModalActionCol}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">
                    {t("Your order cart is empty.")}
                  </td>
                </tr>
              ) : (
                items.map(({ blueprint, quantity, runs }) => (
                  <tr key={blueprint.item_id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <img
                          src={imageServer(blueprint.is_original ? "bpo" : "bpc", blueprint.type_id, 32)}
                          alt={blueprint.type_name}
                          width={28}
                          height={28}
                          className="rounded"
                        />
                        <div>
                          <span className="fw-semibold text-light">{blueprint.type_name}</span>
                          <div className="text-secondary small">
                            ME {blueprint.material_efficiency ?? 0} | TE {blueprint.time_efficiency ?? 0}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {blueprint.is_original ? (
                        <Badge bg="primary">{t("BPO")}</Badge>
                      ) : (
                        <Badge bg="info">{t("BPC")}</Badge>
                      )}
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        min={1}
                        max={999}
                        value={quantity}
                        onChange={(e) =>
                          onUpdateQuantity(blueprint.item_id, Math.max(1, parseInt(e.target.value) || 1))
                        }
                        size="sm"
                        className="bg-dark text-light border-secondary"
                      />
                    </td>
                    <td>
                      {blueprint.is_original ? (
                        <Form.Control
                          type="number"
                          min={1}
                          placeholder={t("Copies runs")}
                          value={runs ?? ""}
                          onChange={(e) =>
                            onUpdateRuns(
                              blueprint.item_id,
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                          size="sm"
                          className="bg-dark text-light border-secondary"
                        />
                      ) : (
                        <span className="text-secondary small">
                          {blueprint.runs ?? 1} {t("runs")}
                        </span>
                      )}
                    </td>
                    <td className="text-end">
                      {renderTooltip(
                        t("Remove item"),
                        <Button
                          variant="danger"
                          size="sm"
                          aria-label={t("Remove item")}
                          onClick={() => onRemoveItem(blueprint.item_id)}
                          className="p-1 aa-btn aa-btn-danger"
                        >
                          <Trash2 size={15} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>

        <Form.Group className="mb-2">
          <Form.Label className="small text-secondary">{t("Note / Instructions (optional)")}</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            placeholder={t("e.g. Delivery location details, contact preference...")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-dark text-light border-secondary"
          />
        </Form.Group>
      </div>
    </BaseModal>
  );
};
