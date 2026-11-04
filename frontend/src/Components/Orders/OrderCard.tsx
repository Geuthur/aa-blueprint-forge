// React
import React, { useMemo, useState } from "react";

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
import { Badge, Button, Card, Collapse } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { components } from "@/Api/OpenApi";
import { BaseModal } from "@/Components/Base/BaseModal";
import { BaseTable } from "@/Components/Base/BaseTable";
import { createBaseColumnHelper } from "@/Components/Base/BaseTable/tableFeatures";
import type { BaseColumnDef } from "@/Components/Base/BaseTable/tableFeatures";
import { imageServer } from "@/Utils/eveOnline";
import { formatDate } from "@/Utils/format";

type Order = components["schemas"]["OrderSchema"];
type OrderItem = components["schemas"]["OrderItemSchema"];

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

  // The API only sends a location to users who may see it
  const showLocation = order.items.some((item) => typeof item.location_name === "string");

  const itemColumns = useMemo<BaseColumnDef<OrderItem, unknown>[]>(() => {
    const columnHelper = createBaseColumnHelper<OrderItem>();

    return [
      columnHelper.accessor("type_name", {
        id: "type_name",
        header: t("Blueprint"),
        cell: ({ row }) => (
          <div className="d-flex align-items-center gap-2">
            <img
              src={imageServer(row.original.runs ? "bpc" : "bpo", row.original.type_id, 32)}
              alt={row.original.type_name}
              width={24}
              height={24}
              className="rounded"
            />
            <span className="fw-semibold">{row.original.type_name}</span>
            {row.original.blueprint_available === false && (
              <Badge bg="secondary">{t("Blueprint no longer available")}</Badge>
            )}
          </div>
        ),
      }),
      ...(showLocation
        ? [
            columnHelper.accessor("location_name", {
              id: "location_name",
              header: t("Location"),
              cell: ({ getValue }) => (
                <span className="small text-light">{String(getValue() || t("Unknown location"))}</span>
              ),
            }),
          ]
        : []),
      columnHelper.accessor("quantity", {
        id: "quantity",
        header: t("Quantity"),
        cell: ({ getValue }) => <span className="badge bg-secondary">{String(getValue())}</span>,
      }),
      columnHelper.accessor("runs", {
        id: "runs",
        header: t("Runs"),
        cell: ({ getValue }) => (
          <span className="text-light small">
            {getValue() ? `${String(getValue())} ${t("runs")}` : t("Standard")}
          </span>
        ),
      }),
      columnHelper.display({
        id: "efficiency",
        header: t("Efficiency"),
        cell: ({ row }) => (
          <span className="small">
            ME {row.original.material_efficiency ?? 0} / TE {row.original.time_efficiency ?? 0}
          </span>
        ),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: t("Item Status"),
        cell: ({ getValue }) => <span className="small text-light">{String(getValue())}</span>,
      }),
    ];
  }, [showLocation, t]);

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
                        className="d-flex align-items-center gap-1"
                        onClick={() => onUpdateStatus(order.id, "Accepted")}
                      >
                        <Check size={14} />
                        <span>{t("Accept")}</span>
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isUpdating || isDeleting}
                        className="d-flex align-items-center gap-1"
                        onClick={() => onUpdateStatus(order.id, "Declined")}
                      >
                        <X size={14} />
                        <span>{t("Decline")}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isUpdating || isDeleting}
                        className="d-flex align-items-center gap-1"
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
                        className="d-flex align-items-center gap-1"
                        onClick={() => onUpdateStatus(order.id, "Delivered")}
                      >
                        <Truck size={14} />
                        <span>{t("Mark Delivered")}</span>
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isUpdating || isDeleting}
                        className="d-flex align-items-center gap-1"
                        onClick={() => onUpdateStatus(order.id, "Declined")}
                      >
                        <X size={14} />
                        <span>{t("Decline")}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isUpdating || isDeleting}
                        className="d-flex align-items-center gap-1"
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
                      className="d-flex align-items-center gap-1"
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
                        className="d-flex align-items-center gap-1"
                        onClick={() => onUpdateStatus(order.id, "Accepted")}
                      >
                        <Check size={14} />
                        <span>{t("Accept")}</span>
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isUpdating}
                        className="d-flex align-items-center gap-1"
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
                      className="d-flex align-items-center gap-1"
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
                      className="d-flex align-items-center gap-1"
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
                className="d-flex align-items-center gap-1 ms-1"
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
          <Collapse in={expanded} mountOnEnter>
            <div className="mt-3 pt-3 border-top border-secondary-subtle">
              <BaseTable
                data={order.items}
                columns={itemColumns}
                enableFilters={false}
                showFooter={false}
                initialState={{ pagination: { pageSize: 1000000 } }}
              />
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
              
            >
              {t("Cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="d-flex align-items-center gap-1"
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
