import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getErrorMessage } from "@/utils/getErrorMessage";
import {
  useCreateSectionMutation,
  useDeleteSectionMutation,
  useGetBatchesQuery,
  useGetSectionsQuery,
  useUpdateSectionMutation,
} from "@/redux/features/foundations/foundations.api";
import { mapBatches, mapSections } from "@/components/foundations/foundations.types";
import type { Section } from "@/types/foundations";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import { SortableTh, useSort, sortSign } from "@/components/foundations/tableSort";
import { toast } from "react-toastify";

type SectionSortKey = "dept" | "batch" | "section";

export function SectionsPanel() {
  const { data: batchesRaw = [] } = useGetBatchesQuery({ limit: 500 });
  const { data: rowsRaw = [], isLoading, error } = useGetSectionsQuery({ limit: 500 });

  const batchOptions = useMemo(() => {
    const batches = mapBatches(batchesRaw);
    return batches.map((b) => ({ id: b.id, label: `${b.dept_name ?? "Dept"} · ${b.name ?? b.number ?? "—"}` }));
  }, [batchesRaw]);

  const rows = mapSections(rowsRaw);

  const [filterDept, setFilterDept] = useState<string>("");
  const [filterBatch, setFilterBatch] = useState<string>("");
  const { sort, onSort } = useSort<SectionSortKey>("batch", "desc");

  const deptFilterOptions = useMemo(
    () => Array.from(new Set(rows.map((s) => s.dept_name).filter((d): d is string => !!d))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const batchFilterOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((s) => s.batch_name).filter((b): b is string => !!b))).sort(
        (a, b) => Number(a) - Number(b),
      ),
    [rows],
  );

  const viewRows = useMemo(() => {
    const sign = sortSign(sort.dir);
    return rows
      .filter((s) => (filterDept ? s.dept_name === filterDept : true))
      .filter((s) => (filterBatch ? s.batch_name === filterBatch : true))
      .sort((a, b) => {
        let primary = 0;
        if (sort.key === "batch") primary = Number(a.batch_name ?? 0) - Number(b.batch_name ?? 0);
        else if (sort.key === "section") primary = (a.name ?? "").localeCompare(b.name ?? "");
        else primary = (a.dept_name ?? "").localeCompare(b.dept_name ?? "");
        if (primary !== 0) return primary * sign;
        // stable tiebreak, always ascending: keep sections grouped by batch then letter
        return Number(a.batch_name ?? 0) - Number(b.batch_name ?? 0) || (a.name ?? "").localeCompare(b.name ?? "");
      });
  }, [rows, filterDept, filterBatch, sort]);

  const [createSection, { isLoading: creating }] = useCreateSectionMutation();
  const [updateSection, { isLoading: updating }] = useUpdateSectionMutation();
  const [deleteSection, { isLoading: deleting }] = useDeleteSectionMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Section | null>(null);
  const [batchId, setBatchId] = useState<string>("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (batchOptions.length > 0 && !batchId) setBatchId(String(batchOptions[0]!.id));
  }, [batchId, batchOptions]);

  const openCreate = () => {
    setEditing(null);
    setBatchId(String(batchOptions[0]?.id ?? ""));
    setName("");
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (s: Section) => {
    setEditing(s);
    setBatchId(String(s.batch_id));
    setName(s.name);
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    if (!batchId || !name.trim()) {
      setFormError("Batch and section name are required.");
      return;
    }
    try {
      const payload = { batch_id: batchId, name: name.trim() };
      if (editing) await updateSection({ id: editing.id, data: payload }).unwrap();
      else await createSection(payload).unwrap();
      setOpen(false);
      toast.success(editing ? "Section updated." : "Section created.");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not save section.");
      setFormError(msg);
      toast.error(msg);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSection(pendingDelete.id).unwrap();
      toast.success("Section deleted.");
      setPendingDelete(null);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not delete section."));
    }
  };

  return (
    <>
      <div className="foundations__toolbar">
        <div className="foundations__toolbar-left">
          <h2 className="foundations__h2" style={{ margin: 0 }}>
            Sections
          </h2>
        </div>
        <div className="foundations__toolbar-right">
          <select
            className="foundations__filter-control"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            {deptFilterOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            className="foundations__filter-control"
            value={filterBatch}
            onChange={(e) => setFilterBatch(e.target.value)}
            aria-label="Filter by batch"
          >
            <option value="">All batches</option>
            {batchFilterOptions.map((b) => (
              <option key={b} value={b}>
                Batch {b}
              </option>
            ))}
          </select>
          {batchOptions.length === 0 ? <span className="foundations__muted">Create a batch first.</span> : null}
          <button className="foundations__btn" type="button" onClick={openCreate} disabled={batchOptions.length === 0}>
            + Add section
          </button>
        </div>
      </div>

      {isLoading ? <p className="foundations__muted">Loading…</p> : null}
      {error ? <p className="foundations__error">Could not load sections.</p> : null}

      <div className="foundations__table-wrap">
        <table className="foundations__table">
          <thead>
            <tr>
              <SortableTh label="Department" sortKey="dept" sort={sort} onSort={onSort} />
              <SortableTh label="Batch" sortKey="batch" sort={sort} onSort={onSort} />
              <SortableTh label="Section" sortKey="section" sort={sort} onSort={onSort} />
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="foundations__empty">
                  No sections yet.
                </td>
              </tr>
            ) : viewRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="foundations__empty">
                  No sections match these filters.
                </td>
              </tr>
            ) : (
              viewRows.map((s) => (
                <tr key={s.id}>
                  <td>{s.dept_name || "—"}</td>
                  <td>{s.batch_name || "—"}</td>
                  <td>
                    <strong>{s.name}</strong>
                  </td>
                  <td>
                    <div className="foundations__actions">
                      <button type="button" className="foundations__icon-btn" onClick={() => openEdit(s)} aria-label="Edit">
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        className="foundations__icon-btn foundations__icon-btn--danger"
                        disabled={deleting}
                        onClick={() => setPendingDelete(s)}
                        aria-label="Delete"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        title={editing ? "Edit section" : "Add section"}
        onClose={() => setOpen(false)}
        footer={
          <div className="foundations__modal-actions">
            <button className="foundations__btn foundations__btn--ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="foundations__btn" type="button" disabled={creating || updating} onClick={() => void submit()}>
              {creating || updating ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        <div className="foundations__form">
          <label className="foundations__field">
            <span>Batch</span>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              {batchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="foundations__field">
            <span>Section name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. A" />
          </label>
          {formError ? <div className="foundations__error">{formError}</div> : null}
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete section"
        message={`Delete section "${pendingDelete?.name ?? ""}"?`}
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
