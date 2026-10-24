// React
import React, { useState } from "react";

// Third Party
import { Bell, Check, ChevronDown, ChevronUp, Save } from "lucide-react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { GroupSchema } from "@/Api/schema";
import styles from "@/Styles/modules/Administration.module.css";

interface GlobalNotificationSettingsCardProps {
    groups?: GroupSchema[];
    isLoading: boolean;
    isError: boolean;
    createdGroupIds: number[];
    statusGroupIds: number[];
    isSaving: boolean;
    savedSuccess: boolean;
    errorMsg: string | null;
    onToggleCreatedGroup: (groupId: number) => void;
    onToggleStatusGroup: (groupId: number) => void;
    onSave: (e: React.FormEvent) => void;
    onDismissSuccess: () => void;
    onDismissError: () => void;
}

export const GlobalNotificationSettingsCard: React.FC<GlobalNotificationSettingsCardProps> = ({
    groups,
    isLoading,
    isError,
    createdGroupIds,
    statusGroupIds,
    isSaving,
    savedSuccess,
    errorMsg,
    onToggleCreatedGroup,
    onToggleStatusGroup,
    onSave,
    onDismissSuccess,
    onDismissError,
}) => {
    const { t } = useTranslation();
    const [showPanel, setShowPanel] = useState(false);

    return (
        <Card className="bg-secondary text-light border-0 shadow-sm mb-4">
            <Card.Header
                className={`d-flex align-items-center justify-content-between bg-transparent py-2 ${styles.cursorPointer}`}
                onClick={() => setShowPanel((prev) => !prev)}
            >
                <div className="d-flex align-items-center gap-2">
                    <Bell size={18} className="text-primary" />
                    <h2 className="h5 mb-0">{t("Global Notification Groups")}</h2>
                </div>
                <Button
                    variant="link"
                    size="sm"
                    className="p-0 text-muted"
                    aria-label={t("Toggle Notification Groups")}
                    data-testid="toggle-notification-panel"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowPanel((prev) => !prev);
                    }}
                >
                    {showPanel ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </Button>
            </Card.Header>
            {showPanel && (
                <Card.Body className="m-2">
                <p className="text-muted small mb-3">
                    {t(
                        "Members of these Alliance Auth groups will receive notifications for all blueprint orders across the system in addition to the respective shop owners.",
                    )}
                </p>

                {savedSuccess && (
                    <Alert variant="success" dismissible onClose={onDismissSuccess}>
                        <Check size={16} className="me-2" />
                        {t("Global notification groups saved successfully.")}
                    </Alert>
                )}

                {errorMsg && (
                    <Alert variant="danger" dismissible onClose={onDismissError}>
                        {errorMsg}
                    </Alert>
                )}

                {isLoading ? (
                    <div className="text-center py-4">
                        <Spinner animation="border" size="sm" />
                    </div>
                ) : isError ? (
                    <Alert variant="danger">{t("Failed to load notification settings or groups.")}</Alert>
                ) : (
                    <Form onSubmit={onSave}>
                        <div className="row g-4 mb-2">
                            <Card.Body className="bg-dark col-md-6">
                                <Form.Label className="fw-semibold">
                                    {t("New Orders (Order Created)")}
                                </Form.Label>
                                <p className="text-muted small mb-2">
                                    {t("Notify these groups whenever any new order is placed.")}
                                </p>
                                <div
                                    className={`p-2 border border-secondary-subtle rounded ${styles.groupScrollBox}`}
                                >
                                    {groups?.map((g) => (
                                        <Form.Check
                                            key={`global-created-${g.id}`}
                                            type="checkbox"
                                            id={`global-created-${g.id}`}
                                            label={g.name}
                                            checked={createdGroupIds.includes(g.id)}
                                            onChange={() => onToggleCreatedGroup(g.id)}
                                            className="small mb-1"
                                        />
                                    ))}
                                </div>
                            </Card.Body>
                            <Card.Body className="bg-dark col-md-6">
                                <Form.Label className="fw-semibold">
                                    {t("Order Status Updates")}
                                </Form.Label>
                                <p className="text-muted small mb-2">
                                    {t("Notify these groups whenever an order status changes.")}
                                </p>
                                <div
                                    className={`p-2 border border-secondary-subtle rounded ${styles.groupScrollBox}`}
                                >
                                    {groups?.map((g) => (
                                        <Form.Check
                                            key={`global-status-${g.id}`}
                                            type="checkbox"
                                            id={`global-status-${g.id}`}
                                            label={g.name}
                                            checked={statusGroupIds.includes(g.id)}
                                            onChange={() => onToggleStatusGroup(g.id)}
                                            className="small mb-1"
                                        />
                                    ))}
                                </div>
                            </Card.Body>
                        </div>

                        <div className="d-flex justify-content-end">
                            <Button
                                variant="primary"
                                type="submit"
                                disabled={isSaving}
                                className="d-flex align-items-center gap-1 aa-btn aa-btn-primary"
                            >
                                {isSaving ? (
                                    <Spinner size="sm" animation="border" />
                                ) : (
                                    <Save size={16} />
                                )}
                                <span>{t("Save Global Settings")}</span>
                            </Button>
                        </div>
                    </Form>
                )}
            </Card.Body>
            )}
        </Card>
    );
};
