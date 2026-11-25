import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { LoadingSpinner } from "@/components/ui/Loading";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import {
  useGetCourseTypesQuery,
  useCreateCourseTypeMutation,
  useUpdateCourseTypeMutation,
  useDeleteCourseTypeMutation,
  useGetAcademicSettingsQuery,
  useUpdateAcademicSettingsMutation,
} from "@/redux/features/foundations/foundations.api";

type CourseType = { id: string; name: string; code: string; credit: number };
const s = (v: unknown) => (v == null ? "" : String(v));

export function CreditsPanel() {
  const { data: raw = [], isLoading, error } = useGetCourseTypesQuery();
  const types = useMemo<CourseType[]>(
    () => (raw as Record<string, unknown>[]).map((t) => ({ id: s(t.id), name: s(t.name), code: s(t.code), credit: Number(t.credit) })),
    [raw],
  );

  const [createType, { isLoading: creating }] = useCreateCourseTypeMutation();
  const [updateType, { isLoading: updating }] = useUpdateCourseTypeMutation();
  const [deleteType, { isLoading: deleting }] = useDeleteCourseTypeMutation();

  const { data: settings } = useGetAcademicSettingsQuery();
  const [updateSettings, { isLoading: savingCap }] = useUpdateAcademicSettingsMutation();
  const [cap, setCap] = useState<number>(20);
  useEffect(() => {
    if (settings?.max_semester_credits != null) setCap(Number(settings.max_semester_credits));
  }, [settings]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CourseType | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CourseType | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [credit, setCredit] = useState(3);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    setCredit(3);
    setFormError(null);
    setOpen(true);
  };
  const openEdit = (t: CourseType) => {
    setEditing(t);
    setName(t.name);
    setCode(t.code);
    setCredit(t.credit);
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    if (!name.trim()) return setFormError("Type name is required.");
    if (!editing && !/^[A-Za-z0-9_-]{1,50}$/.test(code.trim())) {
      return setFormError("Code must be 1–50 chars: letters, numbers, _ or -.");
    }
    if (!Number.isFinite(credit) || credit < 0 || credit > 30) return setFormError("Credit must be between 0 and 30.");
    try {
      if (editing) {
        await updateType({ id: editing.id, data: { name: name.trim(), credit } }).unwrap();
        toast.success("Course type updated — its courses' credits were updated too.");
      } else {
        await createType({ name: name.trim(), code: code.trim().toUpperCase(), credit }).unwrap();
        toast.success("Course type created.");
      }
      setOpen(false);
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not save course type.");
      setFormError(msg);
      toast.error(msg);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteType(pendingDelete.id).unwrap();
      toast.success("Course type deleted.");
      setPendingDelete(null);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not delete course type."));
    }
  };

  const saveCap = async () => {
    if (!Number.isFinite(cap) || cap < 1 || cap > 100) return toast.error("Max credits must be between 1 and 100.");
    try {
      await updateSettings({ max_semester_credits: Math.round(cap) }).unwrap();
      toast.success(`Semester credit cap set to ${Math.round(cap)}.`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not update the credit cap."));
    }
  };

  return (
    <>
      {/* Per-semester credit cap */}
      <div
        className="foundations__toolbar"
        style={{ background: "#fbf5f8", border: "1px solid #e7cdd9", borderRadius: 12, padding: "12px 14px" }}
      >
        <div className="foundations__toolbar-left">
          <div>
            <strong>Max credits per semester</strong>
            <div className="foundations__muted" style={{ margin: 0, fontSize: 12.5 }}>
              A batch's offered courses may not exceed this total.
            </div>
          </div>
        </div>
        <div className="foundations__toolbar-right" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            min={1}
            max={100}
            value={cap}
            onChange={(e) => setCap(Number(e.target.value))}
            style={{ width: 90 }}
            aria-label="Max credits per semester"
          />
          <button className="foundations__btn" type="button" disabled={savingCap} onClick={() => void saveCap()}>
            {savingCap ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Course types */}
      <div className="foundations__toolbar" style={{ marginTop: 14 }}>
        <div className="foundations__toolbar-left">
          <h2 className="foundations__h2" style={{ margin: 0 }}>
            Course types
          </h2>
        </div>
        <div className="foundations__toolbar-right">
          <button className="foundations__btn" type="button" onClick={openCreate}>
            + Add type
          </button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : null}
      {error ? <p className="foundations__error">Could not load course types.</p> : null}

      <div className="foundations__table-wrap" hidden={isLoading}>
        <table className="foundations__table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 120 }}>Code</th>
              <th style={{ width: 100 }}>Credit</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && types.length === 0 ? (
              <tr>
                <td colSpan={4} className="foundations__empty">
                  No course types yet. Add one (e.g. Theory · 3, Lab · 1).
                </td>
              </tr>
            ) : (
              types.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.name}</strong>
                  </td>
                  <td>
                    <span className="foundations__badge">{t.code}</span>
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    {t.credit} {t.credit === 1 ? "credit" : "credits"}
                  </td>
                  <td>
                    <div className="foundations__actions">
                      <button type="button" className="foundations__icon-btn" onClick={() => openEdit(t)} aria-label="Edit">
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        className="foundations__icon-btn foundations__icon-btn--danger"
                        disabled={deleting}
                        onClick={() => setPendingDelete(t)}
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

      <p className="foundations__muted" style={{ marginTop: 10, fontSize: 12.5 }}>
        Editing a type's credit updates every course of that type. A type in use can't be deleted until its courses are reassigned.
      </p>

      <Modal
        open={open}
        title={editing ? "Edit course type" : "Add course type"}
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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thesis" />
          </label>
          <label className="foundations__field">
            <span>Code {editing ? "(fixed)" : ""}</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. THESIS"
              disabled={!!editing}
            />
          </label>
          <label className="foundations__field">
            <span>Credit</span>
            <input type="number" min={0} max={30} step={0.25} value={credit} onChange={(e) => setCredit(Number(e.target.value))} />
          </label>
          {formError ? <div className="foundations__error">{formError}</div> : null}
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete course type"
        message={`Delete the "${pendingDelete?.name ?? ""}" type? Courses already using it must be reassigned first.`}
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
