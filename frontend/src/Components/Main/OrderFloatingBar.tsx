// React
import React from "react";

// Third Party
import { ShoppingCart, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import styles from "@/Styles/modules/Blueprint.module.css";
import { renderTooltip } from "@/Utils";

interface OrderFloatingBarProps {
  itemCount: number;
  onOpenOrderModal: () => void;
  onClearCart: () => void;
}

export const OrderFloatingBar: React.FC<OrderFloatingBarProps> = ({
  itemCount,
  onOpenOrderModal,
  onClearCart,
}) => {
  const { t } = useTranslation();

  if (itemCount === 0) return null;

  return (
    <div
      className={`position-fixed bottom-0 start-50 translate-middle-x mb-4 z-3 shadow-lg ${styles.cartFloatingBar}`}
    >
      <div className={`text-light rounded-pill px-4 py-2 d-flex align-items-center justify-content-between gap-3 border border-light border-opacity-25 shadow ${styles.cartBar}`}>
        <div className="d-flex align-items-center gap-2">
          <ShoppingCart size={20} />
          <span className="fw-bold">
            {t("{{count}} Blueprint selected", { count: itemCount })}
          </span>
        </div>

        <div className="d-flex align-items-center gap-2">
          {renderTooltip(
            t("Clear selection"),
            <Button
              variant="link"
              size="sm"
              aria-label={t("Clear selection")}
              className="text-light text-decoration-none p-0 opacity-75"
              onClick={onClearCart}
            >
              <Trash2 size={16} />
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="rounded-pill fw-bold d-flex align-items-center gap-1 px-3"
            onClick={onOpenOrderModal}
          >
            <span>{t("Review Order")}</span>
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
};
