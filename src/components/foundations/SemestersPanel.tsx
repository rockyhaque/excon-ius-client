import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import {
  useGetSemestersQuery,
  useCreateSemesterMutation,
  useUpdateSemesterMutation,
  useDeleteSemesterMutation,
} from "@/redux/features/foundations/foundations.api";

type Semester = { id: string; name: string; season: string; year: number; is_current: boolean };
const s = (v: unknown) => (v == null ? "" : String(v));
const SEASONS = ["SPRING", "SUMMER", "FALL"];

export function SemestersPanel() {
  const { data: rowsRaw = [], isLoading, error } = useGetSemestersQuery();
  const rows = useMemo<Semester[]>(
    () =>
      (rowsRaw as Record<string, unknown>[])
        .map((r) => ({ id: s(r.id), name: s(r.name), season: s(r.season).toUpperCase(), year: Number(r.year) || 0, is_current: Boolean(r.is_current) }))
        .sort((a, b) => b.year - a.year || a.season.localeCompare(b.season)),
    [rowsRaw],
  );

  const [createSemester, { isLoading: creating }] = useCreateSemesterMutation();
  const [updateSemester, { isLoading: updating }] = useUpdateSemesterMutation();
  const [deleteSemester, { isLoading: deleting }] = useDeleteSemesterMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Semester | null>(null);
  const [name, setName] = useState("");
  const [season, setSeason] = useState("FALL");
  const [year, setYear] = useState(new Date().getFullYear());
  const [isCurrent, setIsCurrent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setSeason("FALL");
    setYear(new Date().getFullYear());
    setIsCurrent(rows.length === 0); // first semester defaults to current
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (sem: Semester) => {
    setEditing(sem);
    setName(sem.name);
    setSeason(sem.season);
    setYear(sem.year);
    setIsCurrent(sem.is_current);
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    if (!name.trim()) return setFormError("Semester name is required.");
    if (!Number.isFinite(year) || year < 2000 || year > 2100) return setFormError("Enter a valid year.");
    try {
      if (editing) {
        await updateSemester({ id: editing.id, data: { name: name.trim(), season, year, is_current: isCurrent } }).unwrap();
      } else {
        await createSemester({ name: name.trim(), season, year, is_current: isCurrent }).unwrap();
      }
      setOpen(false);
      toast.success(editing ? "Semester updated." : "Semester created.");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not save semester.");
      setFormError(msg);
      toast.error(msg);
    }
  };

  const setCurrent = async (sem: Semester) => {
    try {
      await updateSemester({ id: sem.id, data: { is_current: true } }).unwrap();
      toast.success(`"${sem.name}" is now the current semester.`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not set current semester."));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSemester(pendingDelete.id).unwrap();
      toast.success("Semester deleted.");
      setPendingDelete(null);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not delete semester."));
    }
  };

  return (
    <>
      <div className="foundations__toolbar">
        <div className="foundations__toolbar-left">
          <h2 className="foundations__h2" style={{ margin: 0 }}>
            Semesters
          </h2>
        </div>
        <div className="foundations__toolbar-right">
          <button className="foundations__btn" type="button" onClick={openCreate}>
            + Add semester
          </button>
        </div>
      </div>

      {isLoading ? <p className="foundations__muted">Loading…</p> : null}
      {error ? <p className="foundations__error">Could not load semesters.</p> : null}

      <div className="foundations__table-wrap">
        <table className="foundations__table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 120 }}>Season</th>
              <th style={{ width: 90 }}>Year</th>
              <th style={{ width: 150 }}>Current</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="foundations__empty">
                  No semesters yet. Add one to generate a routine against it.
                </td>
              </tr>
            ) : (
              rows.map((sem) => (
                <tr key={sem.id}>
                  <td>
                    <strong>{sem.name}</strong>
                  </td>
                  <td>{sem.season.charAt(0) + sem.season.slice(1).toLowerCase()}</td>
                  <td>{sem.year}</td>
                  <td>
                    {sem.is_current ? (
                      <span className="foundations__badge">Current</span>
                    ) : (
                      <button
                        type="button"
                        className="foundations__btn foundations__btn--ghost"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        disabled={updating}
                        onClick={() => void setCurrent(sem)}
                      >
                        Set current
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="foundations__actions">
                      <button type="button" className="foundations__icon-btn" onClick={() => openEdit(sem)} aria-label="Edit">
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        className="foundations__icon-btn foundations__icon-btn--danger"
                        disabled={deleting}
                        onClick={() => setPendingDelete(sem)}
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
        title={editing ? "Edit semester" : "Add semester"}
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
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fall 2026" />
          </label>
          <label className="foundations__field">
            <span>Season</span>
            <select value={season} onChange={(e) => setSeason(e.target.value)}>
              {SEASONS.map((s2) => (
                <option key={s2} value={s2}>
                  {s2.charAt(0) + s2.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="foundations__field">
            <span>Year</span>
            <input type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} />
            <span className="foundations__muted" style={{ margin: 0 }}>
              Set as the current semester
            </span>
          </label>
          {formError ? <div className="foundations__error">{formError}</div> : null}
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete semester"
        message={`Delete "${pendingDelete?.name ?? ""}"? Exams generated for it will lose their semester link.`}
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
