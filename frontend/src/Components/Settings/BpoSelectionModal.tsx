// React
import React, { useMemo, useState } from "react";

// Third Party
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckSquare, Search, Square, X } from "lucide-react";
import { Alert, Badge, Button, Form, Spinner, Table } from "react-bootstrap";
import { useTranslation } from "react-i18next";

// AA bpforge
import { loadOwnerBpos, updateOwnerBpos } from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";
import { BaseModal } from "@/Components/Base/BaseModal";
import styles from "@/Styles/modules/SettingsPage.module.css";
import { imageServer } from "@/Utils/eveOnline";

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

  const handleToggle = (itemId: number) => {
    setUserSelectedIds((prev) => {
      const next = new Set(prev ?? initialOffered);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

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

  const totalCount = bpos?.length || 0;
  const offeredCount = selectedIds.size;

  const footer = (
    <div className="d-flex align-items-center justify-content-between w-100">
      <Button
        variant="secondary"
        className="aa-btn aa-btn-secondary"
        onClick={handleClose}
        disabled={saveMutation.isPending}
      >
        {t("Cancel")}
      </Button>
      <Button
        variant="primary"
        className="aa-btn aa-btn-primary"
        onClick={handleSave}
        disabled={saveMutation.isPending || isLoading}
      >
        {saveMutation.isPending ? (
          <>
            <Spinner size="sm" animation="border" className="me-2" />
            {t("Saving...")}
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
              placeholder={t("Search blueprints...")}
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
              variant="outline-secondary"
              size="sm"
              onClick={handleSelectAllFiltered}
              disabled={filteredBpos.length === 0}
              className="aa-btn aa-btn-secondary"
            >
              <CheckSquare size={14} className="me-1" />
              {t("Select All")}
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleDeselectAllFiltered}
              disabled={filteredBpos.length === 0}
              className="aa-btn aa-btn-secondary"
            >
              <Square size={14} className="me-1" />
              {t("Deselect All")}
            </Button>
          </div>
        </div>

        <div className="mb-2 text-muted small">
          {t("Offered:")} <strong>{offeredCount}</strong> / {totalCount} BPOs
        </div>

        {isLoading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        ) : isError ? (
          <Alert variant="danger">{t("Failed to load blueprint originals.")}</Alert>
        ) : filteredBpos.length === 0 ? (
          <div className="text-center py-4 text-muted">
            {search ? t("No BPOs match your search.") : t("No BPOs found for this owner.")}
          </div>
        ) : (
          <div className={styles.bpoTableScroll}>
            <Table hover responsive size="sm" className="align-middle mb-0">
              <thead className="table-dark sticky-top">
                <tr>
                  <th className={styles.colSelect} />
                  <th className={styles.colImage} />
                  <th>{t("Blueprint")}</th>
                  <th>{t("Group")}</th>
                  <th className="text-center">{t("ME / TE")}</th>
                  <th>{t("Location")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredBpos.map((bp) => {
                  const isChecked = selectedIds.has(bp.item_id);
                  return (
                    <tr
                      key={bp.item_id}
                      className={styles.clickableRow}
                      onClick={() => handleToggle(bp.item_id)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <Form.Check
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggle(bp.item_id)}
                          aria-label={`Select ${bp.type_name}`}
                        />
                      </td>
                      <td>
                        <img
                          src={imageServer("bpo", bp.type_id, 32)}
                          alt=""
                          width={32}
                          height={32}
                          className="rounded"
                          loading="lazy"
                        />
                      </td>
                      <td className="fw-medium">{bp.type_name}</td>
                      <td className="text-muted small">{bp.group_name || "-"}</td>
                      <td className="text-center small">
                        <span className="badge bg-secondary me-1">
                          ME {bp.material_efficiency ?? 0}
                        </span>
                        <span className="badge bg-secondary">
                          TE {bp.time_efficiency ?? 0}
                        </span>
                      </td>
                      <td className={`text-muted small text-truncate ${styles.colLocation}`}>
                        {bp.location_name || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </BaseModal>
  );
};
