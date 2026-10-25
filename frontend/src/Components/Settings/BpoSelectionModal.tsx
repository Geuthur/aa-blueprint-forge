// React
import React, { useCallback, useMemo, useState } from "react";

// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, CheckSquare, Search, Square, X } from "lucide-react";
import { Alert, Badge, Button, Form, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import { loadOwnerBpos, updateOwnerBpos } from "@/Api/ApiCalls";
import type { components } from "@/Api/OpenApi";
import { queryKeys } from "@/Api/query";
import { BaseModal } from "@/Components/Base/BaseModal";
import { BaseTable } from "@/Components/Base/BaseTable";
import styles from "@/Styles/modules/SettingsPage.module.css";
import { imageServer } from "@/Utils/eveOnline";

type OwnerBpoItem = components["schemas"]["OwnerBpoItemSchema"];

interface BpoSelectionModalProps {
    show: boolean;
    onHide: () => void;
    ownerId: number;
    ownerName: string;
}

export const BpoSelectionModal: React.FC<BpoSelectionModalProps> = ({
    show,
    onHide,
    ownerId,
    ownerName,
}) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const [search, setSearch] = useState("");
    const [userSelectedIds, setUserSelectedIds] = useState<Set<number> | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const {
        data: bpos,
        isLoading,
        isError,
    } = useQuery({
        queryKey: queryKeys.OwnerBpos(ownerId),
        queryFn: () => loadOwnerBpos(ownerId),
        enabled: show && ownerId > 0,
    });

    const initialOffered = useMemo(() => {
        const s = new Set<number>();
        if (bpos) {
            for (const bp of bpos) {
                if (bp.is_offered) {
                    s.add(bp.item_id);
                }
            }
        }
        return s;
    }, [bpos]);

    const selectedIds = userSelectedIds ?? initialOffered;

    const handleClose = () => {
        setUserSelectedIds(null);
        setSearch("");
        setErrorMsg(null);
        onHide();
    };

    const saveMutation = useMutation({
        mutationFn: (ids: number[]) => updateOwnerBpos(ownerId, ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.OwnerBpos(ownerId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.UserOwners });
            queryClient.invalidateQueries({ queryKey: queryKeys.PublicShops });
            queryClient.invalidateQueries({ queryKey: queryKeys.ShopBlueprints(ownerId) });
            handleClose();
        },
        onError: (err: unknown) => {
            setErrorMsg(
                err instanceof Error ? err.message : t("Failed to save blueprint selection.")
            );
        },
    });

    const filteredBpos = useMemo(() => {
        if (!bpos) return [];
        if (!search.trim()) return bpos;
        const lower = search.toLowerCase();
        return bpos.filter(
            (bp) =>
                bp.type_name.toLowerCase().includes(lower) ||
                (bp.group_name && bp.group_name.toLowerCase().includes(lower)) ||
                (bp.location_name && bp.location_name.toLowerCase().includes(lower))
        );
    }, [bpos, search]);

    const handleToggle = useCallback(
        (itemId: number) => {
            setUserSelectedIds((prev) => {
                const next = new Set(prev ?? initialOffered);
                if (next.has(itemId)) {
                    next.delete(itemId);
                } else {
                    next.add(itemId);
                }
                return next;
            });
        },
        [initialOffered]
    );

    const handleSelectAllFiltered = () => {
        setUserSelectedIds((prev) => {
            const next = new Set(prev ?? initialOffered);
            for (const bp of filteredBpos) {
                next.add(bp.item_id);
            }
            return next;
        });
    };

    const handleDeselectAllFiltered = () => {
        setUserSelectedIds((prev) => {
            const next = new Set(prev ?? initialOffered);
            for (const bp of filteredBpos) {
                next.delete(bp.item_id);
            }
            return next;
        });
    };

    const handleSave = () => {
        setErrorMsg(null);
        saveMutation.mutate(Array.from(selectedIds));
    };

    const columns = useMemo<ColumnDef<OwnerBpoItem, unknown>[]>(() => {
        const columnHelper = createColumnHelper<OwnerBpoItem>();

        return [
            columnHelper.display({
                id: "select",
                size: 44,
                enableSorting: false,
                header: () => null,
                cell: ({ row }) => {
                    const bp = row.original;
                    const isChecked = selectedIds.has(bp.item_id);
                    return (
                        <div onClick={(e) => e.stopPropagation()}>
                            <Form.Check
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggle(bp.item_id)}
                                aria-label={`Select ${bp.type_name}`}
                            />
                        </div>
                    );
                },
            }),
            columnHelper.display({
                id: "image",
                size: 48,
                enableSorting: false,
                header: () => null,
                cell: ({ row }) => (
                    <img
                        src={imageServer("bpo", row.original.type_id, 32)}
                        alt=""
                        width={32}
                        height={32}
                        className="rounded"
                        loading="lazy"
                    />
                ),
            }),
            columnHelper.accessor("type_name", {
                id: "type_name",
                header: t("Blueprint"),
                cell: ({ getValue }) => <span className="fw-medium text-truncate">{String(getValue())}</span>,
            }),
            columnHelper.accessor("group_name", {
                id: "group_name",
                header: t("Group"),
                cell: ({ getValue }) => (
                    <span className="text-muted small text-truncate">{String(getValue() || "-")}</span>
                ),
            }),
            columnHelper.display({
                id: "efficiency",
                header: () => <div className="text-center">{t("ME / TE")}</div>,
                cell: ({ row }) => {
                    const bp = row.original;
                    return (
                        <div className="text-center text-truncate small">
                            <span className="badge bg-secondary me-1">
                                ME {bp.material_efficiency ?? 0}
                            </span>
                            <span className="badge bg-secondary">
                                TE {bp.time_efficiency ?? 0}
                            </span>
                        </div>
                    );
                },
            }),
            columnHelper.accessor("location_name", {
                id: "location_name",
                header: t("Location"),
                cell: ({ getValue }) => (
                    <span className={`text-muted small text-truncate d-inline-block ${styles.colLocation}`}>
                        {String(getValue() || "-")}
                    </span>
                ),
            }),
        ];
    }, [selectedIds, t, handleToggle]);

    const totalCount = bpos?.length || 0;
    const offeredCount = selectedIds.size;

    const footer = (
        <div className="d-flex align-items-center justify-content-between w-100">
            <Button
                variant="secondary"
                
                onClick={handleClose}
                disabled={saveMutation.isPending}
            >
                {t("Cancel")}
            </Button>
            <Button
                variant="primary"
                
                onClick={handleSave}
                disabled={saveMutation.isPending || isLoading}
            >
                {saveMutation.isPending ? (
                    <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        {t("Saving…")}
                    </>
                ) : (
                    <>
                        <Check size={16} className="me-1" />
                        {t("Save Selection")}
                    </>
                )}
            </Button>
        </div>
    );

    return (
        <BaseModal
            show={show}
            onHide={handleClose}
            size="xl"
            centered
            backdrop="static"
            title={
                <div className="d-flex align-items-center gap-2">
                    <span>{t("Select Public BPOs")}</span>
                    <Badge bg="secondary" className="fs-6">
                        {ownerName}
                    </Badge>
                </div>
            }
            footer={footer}
        >
            <div className="bg-dark p-3">
                <p className="text-muted small mb-3">
                    {t(
                        "Select individual Blueprint Originals (BPOs) that will be publicly offered in your shop. Unselected BPOs will remain hidden."
                    )}
                </p>

                {errorMsg && (
                    <Alert variant="danger" onClose={() => setErrorMsg(null)} dismissible>
                        {errorMsg}
                    </Alert>
                )}

                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                    <div className={`input-group ${styles.bpoSearchInput}`}>
                        <span className="input-group-text">
                            <Search size={16} />
                        </span>
                        <Form.Control
                            type="text"
                            placeholder={t("Search blueprints…")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <Button variant="outline-secondary" onClick={() => setSearch("")}>
                                <X size={14} />
                            </Button>
                        )}
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleSelectAllFiltered}
                            disabled={filteredBpos.length === 0}
                            
                        >
                            <CheckSquare size={14} className="me-1" />
                            {t("Select All")}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleDeselectAllFiltered}
                            disabled={filteredBpos.length === 0}
                            
                        >
                            <Square size={14} className="me-1" />
                            {t("Deselect All")}
                        </Button>
                    </div>
                </div>

                <div className="mb-2 text-muted small">
                    {t("Offered:")} <strong>{offeredCount}</strong> / {totalCount} BPOs
                </div>

                <BaseTable
                    data={filteredBpos}
                    columns={columns}
                    isFetching={isLoading}
                    isError={isError}
                    emptyText={
                        search
                            ? t("No BPOs match your search.")
                            : t("No BPOs found for this owner.")
                    }
                    initialState={{
                        pagination: { pageSize: 25 },
                    }}
                    pageSizeOptions={[15, 25, 50, 100]}
                    itemLabel={t("BPOs")}
                    onRowClick={(row) => handleToggle(row.original.item_id)}
                    getRowClassName={() => styles.clickableRow}
                />
            </div>
        </BaseModal>
    );
};
