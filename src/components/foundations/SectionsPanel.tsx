import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
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
import { toast } from "react-toastify";

export function SectionsPanel() {
  const { data: batchesRaw = [] } = useGetBatchesQuery();
  const { data: rowsRaw = [], isLoading, error } = useGetSectionsQuery();

  const batchOptions = useMemo(() => {
    const batches = mapBatches(batchesRaw);
    return batches.map((b) => ({ id: b.id, label: `${b.dept_name ?? "Dept"} · ${b.name ?? b.number ?? "—"}` }));
  }, [batchesRaw]);

  const rows = mapSections(rowsRaw);

  const [createSection, { isLoading: creating }] = useCreateSectionMutation();
  const [updateSection, { isLoading: updating }] = useUpdateSectionMutation();
  const [deleteSection, { isLoading: deleting }] = useDeleteSectionMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
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

  const onDelete = async (s: Section) => {
    if (!window.confirm(`Delete section "${s.name}"?`)) return;
    try {
      await deleteSection(s.id).unwrap();
      toast.success("Section deleted.");
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
          <span className="foundations__muted" style={{ margin: 0 }}>
            Sections belong to a batch.
          </span>
        </div>
        <div className="foundations__toolbar-right">
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
              <th>Department</th>
              <th>Batch</th>
              <th>Section</th>
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
            ) : (
              rows.map((s) => (
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
                        onClick={() => void onDelete(s)}
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
    </>
  );
}

