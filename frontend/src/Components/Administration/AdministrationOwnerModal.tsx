// React
import React, { useState } from "react";

// Third Party
import { Layers, Save } from "lucide-react";
import { Alert, Badge, Button, Card, Form, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import type { GroupSchema, OwnerSettingSchema, AdministrationOwnerUpdateRequest } from "@/Api/schema";
import { BaseModal } from "@/Components/Base/BaseModal";
import styles from "@/Styles/modules/Administration.module.css";

interface AdministrationOwnerModalProps {
    owner: OwnerSettingSchema | null;
    groups?: GroupSchema[];
    isSaving: boolean;
    errorMsg: string | null;
    onClose: () => void;
    onSave: (payload: AdministrationOwnerUpdateRequest) => void;
    onDismissError?: () => void;
}

interface AdministrationOwnerModalDialogProps extends Omit<AdministrationOwnerModalProps, "owner"> {
    owner: OwnerSettingSchema;
}

const AdministrationOwnerModalDialog: React.FC<AdministrationOwnerModalDialogProps> = ({
    owner,
    groups,
    isSaving,
    errorMsg,
    onClose,
    onSave,
    onDismissError,
}) => {
    const { t } = useTranslation();

    const [editPublic, setEditPublic] = useState(owner.is_public);
    const [editPublicType, setEditPublicType] = useState<"all" | "bpo" | "bpc">(
        (owner.public_type as "all" | "bpo" | "bpc") || "all"
    );
    const [editSelectiveBpo, setEditSelectiveBpo] = useState(Boolean(owner.selective_bpo_enabled));
    const [editCreatedGroups, setEditCreatedGroups] = useState<number[]>(
        owner.notify_order_created_group_ids || []
    );
    const [editStatusGroups, setEditStatusGroups] = useState<number[]>(
        owner.notify_order_status_group_ids || []
    );

    const toggleGroupInList = (list: number[], id: number) => {
        if (list.includes(id)) {
            return list.filter((item) => item !== id);
        }
        return [...list, id];
    };

    const handleSave = () => {
        onSave({
            is_public: editPublic,
            public_type: editPublicType,
            selective_bpo_enabled: editSelectiveBpo,
            notify_order_created_group_ids: editCreatedGroups,
            notify_order_status_group_ids: editStatusGroups,
        });
    };

    const footer = (
        <div className="d-flex justify-content-between w-100">
            <Button
                variant="secondary"
                className="aa-btn aa-btn-secondary"
                onClick={onClose}
                disabled={isSaving}
            >
                {t("Cancel")}
            </Button>
            <Button
                variant="primary"
                className="aa-btn aa-btn-primary"
                onClick={handleSave}
                disabled={isSaving}
            >
                {isSaving ? (
                    <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        {t("Saving…")}
                    </>
                ) : (
                    <>
                        <Save size={16} className="me-1" />
                        {t("Save Owner Settings")}
                    </>
                )}
            </Button>
        </div>
    );

    return (
        <BaseModal
            show
            onHide={onClose}
            size="xl"
            centered
            backdrop="static"
            title={
                <div className="d-flex align-items-center gap-2">
                    <Layers size={18} />
                    <span>{t("Edit Owner Settings:")}</span>
                    <Badge bg="secondary">{owner.name}</Badge>
                </div>
            }
            footer={footer}
        >
            <Card>
                <Card.Body className="bg-secondary">
                    {errorMsg && (
                        <Alert variant="danger" onClose={onDismissError} dismissible>
                            {errorMsg}
                        </Alert>
                    )}

                    <div className="mb-3">
                        <Form.Check
                            type="switch"
                            id="edit-owner-public"
                            label={t("Public Shop Active")}
                            checked={editPublic}
                            onChange={(e) => setEditPublic(e.currentTarget.checked)}
                            className="fw-semibold"
                        />
                    </div>

                    <div className="mb-3">
                        <Form.Label className="fw-semibold">{t("Public Blueprint Types")}</Form.Label>
                        <Form.Select
                            value={editPublicType}
                            onChange={(e) => setEditPublicType(e.target.value as "all" | "bpo" | "bpc")}
                        >
                            <option value="all">{t("All Blueprints (Originals & Copies)")}</option>
                            <option value="bpo">{t("Only Originals (BPO)")}</option>
                            <option value="bpc">{t("Only Copies (BPC)")}</option>
                        </Form.Select>
                    </div>

                    <div className="mb-4">
                        <Form.Check
                            type="switch"
                            id="edit-owner-selective-bpo"
                            label={t("Selective BPOs (offer only explicitly chosen BPOs)")}
                            checked={editSelectiveBpo}
                            onChange={(e) => setEditSelectiveBpo(e.currentTarget.checked)}
                            className="fw-semibold"
                        />
                    </div>

                    <hr className="border-secondary-subtle my-4" />

                    <h3 className="h6 fw-bold mb-2">
                        {t("Owner-Specific Notification Groups")}
                    </h3>
                    <p className="text-muted small mb-3">
                        {t(
                            "Groups specifically notified for orders belonging to this owner (in addition to global notification groups)."
                        )}
                    </p>

                    <div className="row g-3">
                        <div className="col-md-6">
                            <Form.Label className="small fw-semibold">
                                {t("Order Created Notification Groups")}
                            </Form.Label>
                            <div
                                className={`p-2 border border-secondary-subtle rounded ${styles.ownerModalScrollBox}`}
                            >
                                {groups?.map((g) => (
                                    <Form.Check
                                        key={`owner-created-${g.id}`}
                                        type="checkbox"
                                        id={`owner-created-${g.id}`}
                                        label={g.name}
                                        checked={editCreatedGroups.includes(g.id)}
                                        onChange={() => setEditCreatedGroups((prev) => toggleGroupInList(prev, g.id))}
                                        className="small mb-1"
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="col-md-6">
                            <Form.Label className="small fw-semibold">
                                {t("Order Status Change Notification Groups")}
                            </Form.Label>
                            <div
                                className={`p-2 border border-secondary-subtle rounded ${styles.ownerModalScrollBox}`}
                            >
                                {groups?.map((g) => (
                                    <Form.Check
                                        key={`owner-status-${g.id}`}
                                        type="checkbox"
                                        id={`owner-status-${g.id}`}
                                        label={g.name}
                                        checked={editStatusGroups.includes(g.id)}
                                        onChange={() => setEditStatusGroups((prev) => toggleGroupInList(prev, g.id))}
                                        className="small mb-1"
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </Card.Body>
            </Card>
        </BaseModal>
    );
};

export const AdministrationOwnerModal: React.FC<AdministrationOwnerModalProps> = (props) => {
    if (!props.owner) return null;
    return <AdministrationOwnerModalDialog key={props.owner.id} {...props} owner={props.owner} />;
};
