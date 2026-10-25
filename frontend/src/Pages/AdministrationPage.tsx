// React
import React, { useMemo, useState } from "react";

// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    Building2,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Shield,
    ShieldAlert,
    Trash2,
    User,
} from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import { Badge, Button, ButtonGroup, Card, CardBody, Col, Form, Row, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import {
    deleteAdministrationOwner,
    loadAdministrationGroups,
    loadAdministrationOwnerBlueprints,
    loadAdministrationOwners,
    loadAdministrationSettings,
    loadUserData,
    triggerAdministrationGlobalUpdate,
    triggerAdministrationOwnerUpdate,
    updateAdministrationOwner,
    updateAdministrationSettings,
} from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import type {
    OwnerSettingSchema,
    AdministrationOwnerUpdateRequest,
} from "@/Api/schema";
import { AdministrationInspectionView } from "@/Components/Administration/AdministrationInspectionView";
import { AdministrationOwnerModal } from "@/Components/Administration/AdministrationOwnerModal";
import { AdministrationOwnersTable } from "@/Components/Administration/AdministrationOwnersTable";
import { GlobalNotificationSettingsCard } from "@/Components/Administration/GlobalNotificationSettingsCard";
import { BaseModal } from "@/Components/Base/BaseModal";
import styles from "@/Styles/modules/Administration.module.css";

const AdministrationPage: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    // Superuser-only features (global task queue, force refresh) are hidden for administrators
    const { data: userData } = useQuery({
        queryKey: queryKeys.User,
        queryFn: loadUserData,
    });
    const isSuperuser = Boolean(userData?.user.is_superuser);

    // Queries
    const {
        data: groups,
        isLoading: isLoadingGroups,
    } = useQuery({
        queryKey: queryKeys.AdministrationGroups,
        queryFn: loadAdministrationGroups,
    });

    const {
        data: settings,
        isLoading: isLoadingSettings,
        isError: isErrorSettings,
    } = useQuery({
        queryKey: queryKeys.AdministrationSettings,
        queryFn: loadAdministrationSettings,
    });

    const {
        data: owners,
        isLoading: isLoadingOwners,
        isError: isErrorOwners,
    } = useQuery({
        queryKey: queryKeys.AdministrationOwners,
        queryFn: loadAdministrationOwners,
    });

    // Filter and search state
    const [typeFilter, setTypeFilter] = useState<"all" | "character" | "corporation" | "issues">("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Global settings state
    const [userCreatedGroupIds, setUserCreatedGroupIds] = useState<number[] | null>(null);
    const [userStatusGroupIds, setUserStatusGroupIds] = useState<number[] | null>(null);
    const [globalSavedSuccess, setGlobalSavedSuccess] = useState(false);
    const [globalErrorMsg, setGlobalErrorMsg] = useState<string | null>(null);

    const createdGroupIds = userCreatedGroupIds ?? (settings?.order_created_group_ids || []);
    const statusGroupIds = userStatusGroupIds ?? (settings?.order_status_group_ids || []);

    const handleToggleCreatedGroup = (groupId: number) => {
        setUserCreatedGroupIds((prev) => {
            const current = prev ?? (settings?.order_created_group_ids || []);
            if (current.includes(groupId)) {
                return current.filter((id) => id !== groupId);
            }
            return [...current, groupId];
        });
    };

    const handleToggleStatusGroup = (groupId: number) => {
        setUserStatusGroupIds((prev) => {
            const current = prev ?? (settings?.order_status_group_ids || []);
            if (current.includes(groupId)) {
                return current.filter((id) => id !== groupId);
            }
            return [...current, groupId];
        });
    };

    // Global settings mutation
    const globalMutation = useMutation({
        mutationFn: (payload: Parameters<typeof updateAdministrationSettings>[0]) =>
            updateAdministrationSettings(payload),
        onSuccess: (updated) => {
            queryClient.setQueryData(queryKeys.AdministrationSettings, updated);
            setUserCreatedGroupIds(null);
            setUserStatusGroupIds(null);
            setGlobalSavedSuccess(true);
            setGlobalErrorMsg(null);
            setTimeout(() => setGlobalSavedSuccess(false), 3000);
        },
        onError: (err: unknown) => {
            setGlobalErrorMsg(
                err instanceof Error ? err.message : t("Failed to update global notification settings.")
            );
            setGlobalSavedSuccess(false);
        },
    });

    const handleSaveGlobal = (e: React.FormEvent) => {
        e.preventDefault();
        setGlobalErrorMsg(null);
        globalMutation.mutate({
            order_created_group_ids: createdGroupIds,
            order_status_group_ids: statusGroupIds,
        });
    };

    // Edit Owner Modal state
    const [editingOwner, setEditingOwner] = useState<OwnerSettingSchema | null>(null);
    const [ownerEditError, setOwnerEditError] = useState<string | null>(null);

    const openOwnerModal = (owner: OwnerSettingSchema) => {
        setEditingOwner(owner);
        setOwnerEditError(null);
    };

    const closeOwnerModal = () => {
        setEditingOwner(null);
        setOwnerEditError(null);
    };

    // Owner update mutation
    const ownerMutation = useMutation({
        mutationFn: ({ ownerId, payload }: { ownerId: number; payload: AdministrationOwnerUpdateRequest }) =>
            updateAdministrationOwner(ownerId, payload),
        onSuccess: (updatedOwner) => {
            queryClient.setQueryData<OwnerSettingSchema[]>(queryKeys.AdministrationOwners, (old) =>
                old?.map((o) => (o.id === updatedOwner.id ? updatedOwner : o))
            );
            queryClient.invalidateQueries({ queryKey: queryKeys.UserOwners });
            queryClient.invalidateQueries({ queryKey: queryKeys.PublicCatalogs });
            closeOwnerModal();
        },
        onError: (err: unknown) => {
            setOwnerEditError(err instanceof Error ? err.message : t("Failed to update owner."));
        },
    });

    const handleSaveOwner = (payload: AdministrationOwnerUpdateRequest) => {
        if (!editingOwner) return;
        setOwnerEditError(null);
        ownerMutation.mutate({
            ownerId: editingOwner.id,
            payload,
        });
    };

    // Owner Task Update Mutation
    const [updatingOwnerId, setUpdatingOwnerId] = useState<number | null>(null);
    const [taskFeedback, setTaskFeedback] = useState<{
        variant: "success" | "danger";
        message: string;
    } | null>(null);

    const taskMutation = useMutation({
        mutationFn: ({ ownerId, forceRefresh }: { ownerId: number; forceRefresh: boolean }) =>
            triggerAdministrationOwnerUpdate(ownerId, forceRefresh),
        onSuccess: (res) => {
            setTaskFeedback({
                variant: "success",
                message: res.message || t("Update task queued successfully."),
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.AdministrationOwners });
            queryClient.invalidateQueries({ queryKey: queryKeys.UserCharacterStatuses });
        },
        onError: (err: unknown) => {
            setTaskFeedback({
                variant: "danger",
                message:
                    err instanceof Error
                        ? err.message
                        : t("Failed to trigger update task for owner."),
            });
        },
        onSettled: () => {
            setUpdatingOwnerId(null);
        },
    });

    const handleTriggerOwnerUpdate = (ownerId: number, forceRefresh: boolean) => {
        setUpdatingOwnerId(ownerId);
        setTaskFeedback(null);
        taskMutation.mutate({ ownerId, forceRefresh });
    };

    // Global Force Refresh & Queue Update Mutation
    const [showTaskPanel, setShowTaskPanel] = useState(false);
    const [forceRefreshGlobal, setForceRefreshGlobal] = useState(false);
    const globalQueueMutation = useMutation({
        mutationFn: ({
            target,
            forceRefresh,
        }: {
            target: "characters" | "corporations";
            forceRefresh: boolean;
        }) =>
            triggerAdministrationGlobalUpdate({
                target,
                forceRefresh,
            }),
        onSuccess: (data) => {
            setTaskFeedback({
                variant: "success",
                message: data.message || t("Global update tasks queued successfully."),
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.AdministrationOwners });
        },
        onError: (err: unknown) => {
            setTaskFeedback({
                variant: "danger",
                message:
                    err instanceof Error
                        ? err.message
                        : t("Failed to trigger global update tasks."),
            });
        },
    });

    // Owner Deletion state & mutation
    const [ownerToDelete, setOwnerToDelete] = useState<OwnerSettingSchema | null>(null);

    const deleteOwnerMutation = useMutation({
        mutationFn: (ownerId: number) => deleteAdministrationOwner(ownerId),
        onSuccess: (res) => {
            setTaskFeedback({
                variant: "success",
                message: res.message || t("Owner deleted successfully."),
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.AdministrationOwners });
            queryClient.invalidateQueries({ queryKey: queryKeys.UserOwners });
            queryClient.invalidateQueries({ queryKey: queryKeys.PublicCatalogs });
            setOwnerToDelete(null);
        },
        onError: (err: unknown) => {
            setTaskFeedback({
                variant: "danger",
                message:
                    err instanceof Error
                        ? err.message
                        : t("Failed to delete owner."),
            });
            setOwnerToDelete(null);
        },
    });

    const handleConfirmDelete = () => {
        if (!ownerToDelete) return;
        deleteOwnerMutation.mutate(ownerToDelete.id);
    };

    // Owner Blueprints Inspection state via nuqs URL parameter
    const [inspectOwnerId, setInspectOwnerId] = useQueryState("inspect", parseAsInteger);
    const inspectingOwner = useMemo(
        () => (inspectOwnerId ? owners?.find((o) => o.id === inspectOwnerId) ?? null : null),
        [inspectOwnerId, owners]
    );

    // Filter metrics
    const totalCount = owners?.length ?? 0;
    const charCount = owners?.filter((o) => !o.is_corporation).length ?? 0;
    const corpCount = owners?.filter((o) => o.is_corporation).length ?? 0;
    const issuesCount =
        owners?.filter((o) => o.has_error || o.status === "error" || o.status === "token_error").length ?? 0;

    // Filtered owners
    const filteredOwners = useMemo(() => {
        if (!owners) return [];
        return owners.filter((owner) => {
            if (typeFilter === "character" && owner.is_corporation) {
                return false;
            }
            if (typeFilter === "corporation" && !owner.is_corporation) {
                return false;
            }
            if (
                typeFilter === "issues" &&
                !owner.has_error &&
                owner.status !== "error" &&
                owner.status !== "token_error"
            ) {
                return false;
            }
            if (searchTerm.trim()) {
                const query = searchTerm.toLowerCase();
                const matchesName = owner.name?.toLowerCase().includes(query);
                const matchesChar = owner.character_name?.toLowerCase().includes(query);
                const matchesCorp = owner.corporation_name?.toLowerCase().includes(query);
                const matchesTicker = owner.corporation_ticker?.toLowerCase().includes(query);
                return Boolean(matchesName || matchesChar || matchesCorp || matchesTicker);
            }
            return true;
        });
    }, [owners, typeFilter, searchTerm]);

    const {
        data: ownerBlueprints = [],
        isLoading: isLoadingOwnerBlueprints,
        isError: isErrorOwnerBlueprints,
        refetch: refetchOwnerBlueprints,
    } = useQuery({
        queryKey: inspectingOwner
            ? queryKeys.AdministrationOwnerBlueprints(inspectingOwner.id)
            : ["none"],
        queryFn: () =>
            inspectingOwner
                ? loadAdministrationOwnerBlueprints(inspectingOwner.id)
                : Promise.resolve([]),
        enabled: Boolean(inspectingOwner),
    });

    if (inspectingOwner) {
        return (
            <AdministrationInspectionView
                inspectingOwner={inspectingOwner}
                ownerBlueprints={ownerBlueprints}
                isLoading={isLoadingOwnerBlueprints}
                isError={isErrorOwnerBlueprints}
                updatingOwnerId={updatingOwnerId}
                taskFeedback={taskFeedback}
                onDismissFeedback={() => setTaskFeedback(null)}
                onBack={() => setInspectOwnerId(null)}
                onRefetch={() => refetchOwnerBlueprints()}
                isSuperuser={isSuperuser}
                onTriggerUpdate={handleTriggerOwnerUpdate}
            />
        );
    }

    return (
        <Card className="bg-dark d-flex flex-column gap-3">
            <CardBody>
                <header className="d-flex align-items-center gap-3 mb-4">
                    <div className="p-2 rounded bg-danger-subtle text-danger border border-danger-subtle">
                        <ShieldAlert size={28} />
                    </div>
                    <div>
                        <h1 className="h3 mb-1 fw-bold">{t("Administration")}</h1>
                        <p className="mb-0 small">
                            {t(
                                "System-wide management of blueprint owners and configuration of Alliance Auth notification groups."
                            )}
                        </p>
                    </div>
                </header>

                {/* Metrics Row */}
                <Row className="g-3 mt-1 mb-3">
                    <Col xs={12} sm={6} md={3}>
                        <Card className="bg-body border-secondary h-100 shadow-sm">
                            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
                                <div>
                                    <span className="text-muted small fw-semibold">{t("Total Owners")}</span>
                                    <h4 className="mb-0 text-light fw-bold">{totalCount}</h4>
                                </div>
                                <div className="p-2 rounded-3 bg-secondary bg-opacity-25 text-light">
                                    <Shield size={24} />
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col xs={12} sm={6} md={3}>
                        <Card className="bg-body border-secondary h-100 shadow-sm">
                            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
                                <div>
                                    <span className="text-muted small fw-semibold">{t("Characters")}</span>
                                    <h4 className="mb-0 text-primary fw-bold">{charCount}</h4>
                                </div>
                                <div className="p-2 rounded-3 bg-primary bg-opacity-10 text-primary">
                                    <User size={24} />
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col xs={12} sm={6} md={3}>
                        <Card className="bg-body border-secondary h-100 shadow-sm">
                            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
                                <div>
                                    <span className="text-muted small fw-semibold">{t("Corporations")}</span>
                                    <h4 className="mb-0 text-secondary fw-bold">{corpCount}</h4>
                                </div>
                                <div className="p-2 rounded-3 bg-secondary bg-opacity-10 text-secondary">
                                    <Building2 size={24} />
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col xs={12} sm={6} md={3}>
                        <Card className="bg-body border-secondary h-100 shadow-sm">
                            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
                                <div>
                                    <span className="text-muted small fw-semibold">{t("Sync Issues")}</span>
                                    <h4 className={`mb-0 fw-bold ${issuesCount > 0 ? "text-danger" : "text-success"}`}>
                                        {issuesCount}
                                    </h4>
                                </div>
                                <div
                                    className={`p-2 rounded-3 ${issuesCount > 0
                                        ? "bg-danger bg-opacity-10 text-danger"
                                        : "bg-success bg-opacity-10 text-success"
                                        }`}
                                >
                                    {issuesCount > 0 ? <AlertTriangle size={24} /> : <Shield size={24} />}
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                <GlobalNotificationSettingsCard
                    groups={groups}
                    isLoading={isLoadingSettings || isLoadingGroups}
                    isError={isErrorSettings}
                    createdGroupIds={createdGroupIds}
                    statusGroupIds={statusGroupIds}
                    isSaving={globalMutation.isPending}
                    savedSuccess={globalSavedSuccess}
                    errorMsg={globalErrorMsg}
                    onToggleCreatedGroup={handleToggleCreatedGroup}
                    onToggleStatusGroup={handleToggleStatusGroup}
                    onSave={handleSaveGlobal}
                    onDismissSuccess={() => setGlobalSavedSuccess(false)}
                    onDismissError={() => setGlobalErrorMsg(null)}
                />

                {/* Global Task Update Panel (Collapsible, superuser only) */}
                {isSuperuser && (
                <Card className="bg-dark border-secondary mb-4 shadow-sm">
                    <Card.Header
                        className={`border-secondary d-flex align-items-center justify-content-between py-2 ${styles.cursorPointer}`}
                        onClick={() => setShowTaskPanel((prev) => !prev)}
                    >
                        <div className="d-flex align-items-center gap-2">
                            <RefreshCw size={16} className="text-primary" />
                            <span className="fw-semibold text-light">{t("Global Task Management")}</span>
                        </div>
                        <Button
                            variant="link"
                            size="sm"
                            className="p-0 text-muted"
                            aria-label={t("Toggle Task Management")}
                            data-testid="toggle-task-panel"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowTaskPanel((prev) => !prev);
                            }}
                        >
                            {showTaskPanel ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </Button>
                    </Card.Header>

                    {showTaskPanel && (
                        <Card.Body className="p-3">
                            <Form.Group className="mb-3">
                                <Form.Check
                                    type="switch"
                                    id="global-force-refresh"
                                    label={<span className="small text-muted">{t("Force Refresh ESI")}</span>}
                                    checked={forceRefreshGlobal}
                                    onChange={(e) => setForceRefreshGlobal(e.target.checked)}
                                />
                            </Form.Group>

                            <Row className="g-3">
                                <Col md={6}>
                                    <Card className="bg-dark border-secondary h-100">
                                        <Card.Header className="border-secondary py-2">
                                            <h6 className="mb-0 text-light">{t("Characters")}</h6>
                                        </Card.Header>
                                        <Card.Body className="d-flex flex-column justify-content-between p-3">
                                            <p className="text-muted small">
                                                {t("Queue background tasks to synchronize all active character owners.")}
                                            </p>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                disabled={globalQueueMutation.isPending}
                                                onClick={() =>
                                                    globalQueueMutation.mutate({
                                                        target: "characters",
                                                        forceRefresh: forceRefreshGlobal,
                                                    })
                                                }
                                                className="w-100 d-flex align-items-center justify-content-center gap-1 aa-btn aa-btn-primary"
                                                data-testid="update-all-characters-btn"
                                            >
                                                {globalQueueMutation.isPending ? (
                                                    <Spinner size="sm" animation="border" />
                                                ) : (
                                                    <User size={14} />
                                                )}
                                                {t("Update All Characters")}
                                            </Button>
                                        </Card.Body>
                                    </Card>
                                </Col>

                                <Col md={6}>
                                    <Card className="bg-dark border-secondary h-100">
                                        <Card.Header className="border-secondary py-2">
                                            <h6 className="mb-0 text-light">{t("Corporations")}</h6>
                                        </Card.Header>
                                        <Card.Body className="d-flex flex-column justify-content-between p-3">
                                            <p className="text-muted small">
                                                {t("Queue background tasks to synchronize all active corporation owners.")}
                                            </p>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                disabled={globalQueueMutation.isPending}
                                                onClick={() =>
                                                    globalQueueMutation.mutate({
                                                        target: "corporations",
                                                        forceRefresh: forceRefreshGlobal,
                                                    })
                                                }
                                                className="w-100 d-flex align-items-center justify-content-center gap-1 aa-btn aa-btn-primary"
                                                data-testid="update-all-corporations-btn"
                                            >
                                                {globalQueueMutation.isPending ? (
                                                    <Spinner size="sm" animation="border" />
                                                ) : (
                                                    <Building2 size={14} />
                                                )}
                                                {t("Update All Corporations")}
                                            </Button>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>
                        </Card.Body>
                    )}
                </Card>
                )}

                {/* Filter and Search Bar */}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mt-4 mb-2">
                    <ButtonGroup size="sm">
                        <Button
                            variant={typeFilter === "all" ? "primary" : "secondary"}
                            onClick={() => setTypeFilter("all")}
                            className={`aa-btn ${typeFilter === "all" ? "aa-btn-primary" : "aa-btn-secondary"}`}
                        >
                            {t("All")} <Badge bg="secondary" className="ms-1">{totalCount}</Badge>
                        </Button>
                        <Button
                            variant={typeFilter === "character" ? "primary" : "secondary"}
                            onClick={() => setTypeFilter("character")}
                            className={`aa-btn ${typeFilter === "character" ? "aa-btn-primary" : "aa-btn-secondary"}`}
                        >
                            {t("Characters")} <Badge bg="secondary" className="ms-1">{charCount}</Badge>
                        </Button>
                        <Button
                            variant={typeFilter === "corporation" ? "primary" : "secondary"}
                            onClick={() => setTypeFilter("corporation")}
                            className={`aa-btn ${typeFilter === "corporation" ? "aa-btn-primary" : "aa-btn-secondary"}`}
                        >
                            {t("Corporations")} <Badge bg="secondary" className="ms-1">{corpCount}</Badge>
                        </Button>
                        <Button
                            variant={typeFilter === "issues" ? "primary" : "secondary"}
                            onClick={() => setTypeFilter("issues")}
                            className={`aa-btn ${typeFilter === "issues" ? "aa-btn-primary" : "aa-btn-secondary"}`}
                        >
                            {t("Issues")} <Badge bg="secondary" className="ms-1">{issuesCount}</Badge>
                        </Button>
                    </ButtonGroup>

                    <div style={{ maxWidth: "300px", width: "100%" }}>
                        <Form.Control
                            type="search"
                            placeholder={t("Search by name or corporation…")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            size="sm"
                            className="bg-dark text-light border-secondary"
                            aria-label={t("Search owners")}
                        />
                    </div>
                </div>

                <AdministrationOwnersTable
                    owners={filteredOwners}
                    isLoading={isLoadingOwners}
                    isError={isErrorOwners}
                    updatingOwnerId={updatingOwnerId}
                    taskFeedback={taskFeedback}
                    onDismissFeedback={() => setTaskFeedback(null)}
                    onInspect={(owner) => setInspectOwnerId(owner.id)}
                    onEdit={(owner) => openOwnerModal(owner)}
                    isSuperuser={isSuperuser}
                    onTriggerUpdate={handleTriggerOwnerUpdate}
                    onDelete={(owner) => setOwnerToDelete(owner)}
                />

                <AdministrationOwnerModal
                    owner={editingOwner}
                    groups={groups}
                    isSaving={ownerMutation.isPending}
                    errorMsg={ownerEditError}
                    onClose={closeOwnerModal}
                    onSave={handleSaveOwner}
                    onDismissError={() => setOwnerEditError(null)}
                />

                <BaseModal
                    show={Boolean(ownerToDelete)}
                    onHide={() => !deleteOwnerMutation.isPending && setOwnerToDelete(null)}
                    centered
                    title={
                        <div className="d-flex align-items-center gap-2 text-danger">
                            <Trash2 size={20} />
                            <span>{t("Delete Owner")}</span>
                        </div>
                    }
                    footer={
                        <div className="d-flex align-items-center justify-content-end gap-2 w-100">
                            <Button
                                variant="secondary"
                                onClick={() => setOwnerToDelete(null)}
                                disabled={deleteOwnerMutation.isPending}
                                className="aa-btn aa-btn-secondary"
                            >
                                {t("Cancel")}
                            </Button>
                            <Button
                                variant="danger"
                                onClick={handleConfirmDelete}
                                disabled={deleteOwnerMutation.isPending}
                                className="aa-btn aa-btn-danger d-flex align-items-center gap-1"
                            >
                                <Trash2 size={14} />
                                <span>
                                    {deleteOwnerMutation.isPending
                                        ? t("Deleting…")
                                        : t("Confirm Delete")}
                                </span>
                            </Button>
                        </div>
                    }
                >
                    <div className="p-3">
                        <div className="d-flex align-items-start gap-3">
                            <AlertTriangle className="text-danger flex-shrink-0 mt-1" size={24} />
                            <div>
                                <p className="fw-semibold mb-1">
                                    {t("Are you sure you want to delete owner '{{name}}'?", {
                                        name: ownerToDelete?.name,
                                    })}
                                </p>
                                <p className="small text-muted mb-2">
                                    {t(
                                        "This will permanently delete this owner, removing all associated blueprints, update statuses, and related configurations. This action cannot be undone."
                                    )}
                                </p>
                                {ownerToDelete && (
                                    <div className="p-2 rounded border border-secondary-subtle small bg-body">
                                        <div>
                                            <strong>{t("Type:")}</strong>{" "}
                                            {ownerToDelete.is_corporation
                                                ? t("Corporation")
                                                : t("Character")}
                                        </div>
                                        <div>
                                            <strong>{t("Total Blueprints:")}</strong>{" "}
                                            {ownerToDelete.blueprint_count ??
                                                (ownerToDelete.bpo_count + ownerToDelete.bpc_count)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </BaseModal>
            </CardBody>
        </Card>
    );
};

export default AdministrationPage;
