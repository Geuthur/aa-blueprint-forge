// React
import React, { useState } from "react";

// Third Party
import { ChevronDown, ChevronUp, Check, X, Truck, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, Badge, Button, Collapse, Table } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { components } from "@/Api/OpenApi";
import { imageServer } from "@/Utils/eveOnline";

type Order = components["schemas"]["OrderSchema"];

interface OrderCardProps {
  order: Order;
  currentUserId?: number;
  onUpdateStatus: (orderId: number, status: string) => Promise<void>;
  isUpdating?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  currentUserId,
  onUpdateStatus,
  isUpdating = false,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const isBuyer = currentUserId === order.requesting_user_id;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <Badge bg="warning" text="dark" className="d-flex align-items-center gap-1"><Clock size={12} /> {t("Pending")}</Badge>;
      case "Accepted":
        return <Badge bg="info" className="d-flex align-items-center gap-1"><CheckCircle size={12} /> {t("Accepted")}</Badge>;
      case "Delivered":
        return <Badge bg="success" className="d-flex align-items-center gap-1"><Truck size={12} /> {t("Delivered")}</Badge>;
      case "Cancelled":
        return <Badge bg="secondary" className="d-flex align-items-center gap-1"><X size={12} /> {t("Cancelled")}</Badge>;
      case "Declined":
        return <Badge bg="danger" className="d-flex align-items-center gap-1"><AlertTriangle size={12} /> {t("Declined")}</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  return (
    <Card className="aa-panel border-0 shadow-sm mb-3">
      <Card.Body className="p-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          {/* Order Header / Meta */}
          <div className="d-flex align-items-center gap-3">
            <div>
              <div className="d-flex align-items-center gap-2">
                <h5 className="mb-0 fw-bold text-light">
                  {t("Order #{{id}}", { id: order.id })}
                </h5>
                {getStatusBadge(order.status)}
              </div>
              <div className="text-secondary small mt-1 d-flex flex-wrap align-items-center gap-2">
                <span>
                  <strong>{t("Owner:")}</strong> {order.owner_name}
                </span>
                <span>•</span>
                <span>
                  <strong>{t("Buyer:")}</strong> {order.requesting_user_name}
                </span>
                <span>•</span>
                <span>{new Date(order.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons & Expand Toggle */}
          <div className="d-flex align-items-center gap-2">
            {/* Seller Controls */}
            {!isBuyer && order.status === "Pending" && (
              <>
                <Button
                  size="sm"
                  disabled={isUpdating}
                  className="d-flex align-items-center gap-1 aa-btn aa-btn-success"
                  onClick={() => onUpdateStatus(order.id, "Accepted")}
                >
                  <Check size={14} />
                  <span>{t("Accept")}</span>
                </Button>
                <Button
                  size="sm"
                  disabled={isUpdating}
                  className="d-flex align-items-center gap-1 aa-btn aa-btn-danger"
                  onClick={() => onUpdateStatus(order.id, "Declined")}
                >
                  <X size={14} />
                  <span>{t("Decline")}</span>
                </Button>
              </>
            )}

            {!isBuyer && order.status === "Accepted" && (
              <Button
                size="sm"
                disabled={isUpdating}
                className="d-flex align-items-center gap-1 aa-btn aa-btn-primary"
                onClick={() => onUpdateStatus(order.id, "Delivered")}
              >
                <Truck size={14} />
                <span>{t("Mark Delivered")}</span>
              </Button>
            )}

            {/* Buyer Controls */}
            {isBuyer && order.status === "Pending" && (
              <Button
                size="sm"
                disabled={isUpdating}
                className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
                onClick={() => onUpdateStatus(order.id, "Cancelled")}
              >
                <X size={14} />
                <span>{t("Cancel Order")}</span>
              </Button>
            )}

            {/* Expand Items Toggle */}
            <Button
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="d-flex align-items-center gap-1 ms-1 aa-btn aa-btn-secondary"
            >
              <span>{order.items.length} {t("Items")}</span>
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
          </div>
        </div>

        {/* Note if available */}
        {order.note && (
          <div className="mt-2 p-2 bg-dark rounded border border-secondary-subtle small text-light-emphasis">
            <strong>{t("Customer Note:")}</strong> {order.note}
          </div>
        )}

        {/* Collapsible Items Table */}
        <Collapse in={expanded}>
          <div className="mt-3 pt-3 border-top border-secondary">
            <Table variant="dark" responsive hover size="sm" className="align-middle mb-0">
              <thead className="table-secondary text-dark small">
                <tr>
                  <th>{t("Blueprint")}</th>
                  <th>{t("Quantity")}</th>
                  <th>{t("Runs")}</th>
                  <th>{t("Efficiency")}</th>
                  <th>{t("Item Status")}</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <img
                          src={imageServer(item.runs ? "bpc" : "bpo", item.type_id, 32)}
                          alt={item.type_name}
                          width={24}
                          height={24}
                          className="rounded"
                        />
                        <span className="fw-semibold text-light">{item.type_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-secondary">{item.quantity}</span>
                    </td>
                    <td>
                      <span className="text-secondary small">
                        {item.runs ? `${item.runs} ${t("runs")}` : t("Standard")}
                      </span>
                    </td>
                    <td>
                      <span className="small">
                        ME {item.material_efficiency ?? 0} / TE {item.time_efficiency ?? 0}
                      </span>
                    </td>
                    <td>
                      <span className="small text-secondary">{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Collapse>
      </Card.Body>
    </Card>
  );
};
