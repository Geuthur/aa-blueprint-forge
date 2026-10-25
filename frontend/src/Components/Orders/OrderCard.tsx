// React
import React, { useState } from "react";

// Third Party
import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { Badge, Button, Card, Collapse, Table } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { components } from "@/Api/OpenApi";
import { BaseModal } from "@/Components/Base/BaseModal";
import { imageServer } from "@/Utils/eveOnline";
import { formatDate } from "@/Utils/format";

type Order = components["schemas"]["OrderSchema"];

interface OrderCardProps {
  order: Order;
  currentUserId?: number;
  canManageOrders?: boolean;
  onUpdateStatus: (orderId: number, status: string) => Promise<void>;
  onDeleteOrder?: (orderId: number) => Promise<void>;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  currentUserId,
  canManageOrders = false,
  onUpdateStatus,
  onDeleteOrder,
  isUpdating = false,
  isDeleting = false,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isBuyer = currentUserId === order.requesting_user_id;

  const handleConfirmDelete = async () => {
    if (onDeleteOrder) {
      await onDeleteOrder(order.id);
      setShowDeleteModal(false);
    }
  };

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
    <>
      <Card className="bg-dark border-0 shadow-sm mb-3">
        <Card.Body className="p-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            {/* Order Header / Meta */}
            <div className="d-flex align-items-center gap-3">
              <div>
                <div className="d-flex align-items-center gap-2">
                  <h5 className="mb-0 fw-bold">
                    {t("Order #{{id}}", { id: order.id })}
                  </h5>
                  {getStatusBadge(order.status)}
                </div>
                <div className="text-light small mt-1 d-flex flex-wrap align-items-center gap-2">
                  <span>
                    <strong>{t("Owner:")}</strong> {order.owner_name}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>{t("Buyer:")}</strong> {order.requesting_user_name}
                  </span>
                  <span>•</span>
                  <span>{formatDate(order.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons & Expand Toggle */}
            <div className="d-flex align-items-center gap-2">
              {/* Manager Controls */}
              {canManageOrders ? (
                <>
                  {order.status === "Pending" && (
                    <>
                      <Button
                        variant="success"
                        size="sm"
                        disabled={isUpdating || isDeleting}
                        className="d-flex align-items-center gap-1 aa-btn aa-btn-success"
                        onClick={() => onUpdateStatus(order.id, "Accepted")}
                      >
                        <Check size={14} />
                        <span>{t("Accept")}</span>
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isUpdating || isDeleting}
                        className="d-flex align-items-center gap-1 aa-btn aa-btn-danger"
                        onClick={() => onUpdateStatus(order.id, "Declined")}
                      >
                        <X size={14} />
                        <span>{t("Decline")}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isUpdating || isDeleting}
                        className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
                        onClick={() => onUpdateStatus(order.id, "Cancelled")}
                      >
                        <X size={14} />
                        <span>{t("Cancel")}</span>
                      </Button>
                    </>
                  )}

                  {order.status === "Accepted" && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isUpdating || isDeleting}
                        className="d-flex align-items-center gap-1 aa-btn aa-btn-primary"
                        onClick={() => onUpdateStatus(order.id, "Delivered")}
                      >
                        <Truck size={14} />
                        <span>{t("Mark Delivered")}</span>
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isUpdating || isDeleting}
                        className="d-flex align-items-center gap-1 aa-btn aa-btn-danger"
                        onClick={() => onUpdateStatus(order.id, "Declined")}
                      >
                        <X size={14} />
                        <span>{t("Decline")}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isUpdating || isDeleting}
                        className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
                        onClick={() => onUpdateStatus(order.id, "Cancelled")}
                      >
                        <X size={14} />
                        <span>{t("Cancel")}</span>
                      </Button>
                    </>
                  )}

                  {onDeleteOrder && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isUpdating || isDeleting}
                      className="d-flex align-items-center gap-1 aa-btn aa-btn-danger"
                      onClick={() => setShowDeleteModal(true)}
                    >
                      <Trash2 size={14} />
                      <span>{t("Delete")}</span>
                    </Button>
                  )}
                </>
              ) : (
                /* Standard Buyer / Seller Controls */
                <>
                  {!isBuyer && order.status === "Pending" && (
                    <>
                      <Button
                        variant="success"
                        size="sm"
                        disabled={isUpdating}
                        className="d-flex align-items-center gap-1 aa-btn aa-btn-success"
                        onClick={() => onUpdateStatus(order.id, "Accepted")}
                      >
                        <Check size={14} />
                        <span>{t("Accept")}</span>
                      </Button>
                      <Button
                        variant="danger"
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
                      variant="primary"
                      size="sm"
                      disabled={isUpdating}
                      className="d-flex align-items-center gap-1 aa-btn aa-btn-primary"
                      onClick={() => onUpdateStatus(order.id, "Delivered")}
                    >
                      <Truck size={14} />
                      <span>{t("Mark Delivered")}</span>
                    </Button>
                  )}

                  {isBuyer && order.status === "Pending" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isUpdating}
                      className="d-flex align-items-center gap-1 aa-btn aa-btn-secondary"
                      onClick={() => onUpdateStatus(order.id, "Cancelled")}
                    >
                      <X size={14} />
                      <span>{t("Cancel Order")}</span>
                    </Button>
                  )}
                </>
              )}

              {/* Expand Items Toggle */}
              <Button
                variant="secondary"
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
            <div className="mt-2 p-2 rounded border border-secondary-subtle small bg-body">
              <strong>{t("Customer Note:")}</strong> {order.note}
            </div>
          )}

          {/* Collapsible Items Table */}
          <Collapse in={expanded}>
            <div className="mt-3 pt-3 border-top border-secondary-subtle">
              <Table responsive hover size="sm" className="align-middle mb-0">
                <thead className="small text-light">
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
                          <span className="fw-semibold">{item.type_name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-secondary">{item.quantity}</span>
                      </td>
                      <td>
                        <span className="text-light small">
                          {item.runs ? `${item.runs} ${t("runs")}` : t("Standard")}
                        </span>
                      </td>
                      <td>
                        <span className="small">
                          ME {item.material_efficiency ?? 0} / TE {item.time_efficiency ?? 0}
                        </span>
                      </td>
                      <td>
                        <span className="small text-light">{item.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Collapse>
        </Card.Body>
      </Card>

      {/* Delete Confirmation Modal */}
      <BaseModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        centered
        title={
          <div className="d-flex align-items-center gap-2 text-danger">
            <Trash2 size={20} />
            <span>{t("Delete Order #{{id}}", { id: order.id })}</span>
          </div>
        }
        footer={
          <div className="d-flex align-items-center justify-content-end gap-2 w-100">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              className="aa-btn aa-btn-secondary"
            >
              {t("Cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="aa-btn aa-btn-danger d-flex align-items-center gap-1"
            >
              <Trash2 size={14} />
              <span>{isDeleting ? t("Deleting…") : t("Confirm Delete")}</span>
            </Button>
          </div>
        }
      >
        <div className="bg-dark p-3">
          <div className="d-flex align-items-start gap-3">
            <AlertTriangle className="text-danger flex-shrink-0 mt-1" size={24} />
            <div>
              <p className="fw-semibold mb-1">
                {t("Are you sure you want to permanently delete this order?")}
              </p>
              <p className="small mb-2">
                {t(
                  "This will permanently remove Order #{{id}} and all {{count}} blueprint item(s) from the system. This action cannot be undone.",
                  { id: order.id, count: order.items.length },
                )}
              </p>
              <div className="p-2 rounded border border-secondary-subtle small bg-body">
                <div>
                  <strong>{t("Owner:")}</strong> {order.owner_name}
                </div>
                <div>
                  <strong>{t("Buyer:")}</strong> {order.requesting_user_name}
                </div>
                <div>
                  <strong>{t("Status:")}</strong> {order.status}
                </div>
              </div>
            </div>
          </div>
        </div>
      </BaseModal>
    </>
  );
};
