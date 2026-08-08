import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getErrorMessage } from "@/utils/getErrorMessage";
import {
  useCreateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetDepartmentsQuery,
  useUpdateDepartmentMutation,
} from "@/redux/features/foundations/foundations.api";
import { mapDepartments } from "@/components/foundations/foundations.types";
import type { Department } from "@/types/foundations";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import { toast } from "react-toastify";

export function DepartmentsPanel() {
  const { data: rowsRaw = [], isLoading, error } = useGetDepartmentsQuery();
  const rows = mapDepartments(rowsRaw);

  const [createDepartment, { isLoading: creating }] = useCreateDepartmentMutation();
  const [updateDepartment, { isLoading: updating }] = useUpdateDepartmentMutation();
  const [deleteDepartment, { isLoading: deleting }] = useDeleteDepartmentMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setName(d.name);
    setCode(d.code);
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    if (!name.trim() || !code.trim()) {
      setFormError("Name and code are required.");
      return;
    }
    try {
      if (editing) await updateDepartment({ id: editing.id, data: { name: name.trim(), code: code.trim() } }).unwrap();
      else await createDepartment({ name: name.trim(), code: code.trim() }).unwrap();
      setOpen(false);
      toast.success(editing ? "Department updated." : "Department created.");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not save department.");
      setFormError(msg);
      toast.error(msg);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteDepartment(pendingDelete.id).unwrap();
      toast.success("Department deleted.");
      setPendingDelete(null);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not delete department."));
    }
  };

  return (
    <>
      <div className="foundations__toolbar">
        <div className="foundations__toolbar-left">
          <h2 className="foundations__h2" style={{ margin: 0 }}>
            Departments
          </h2>
        </div>
        <div className="foundations__toolbar-right">
          <button className="foundations__btn" type="button" onClick={openCreate}>
            + Add department
          </button>
        </div>
      </div>

      {isLoading ? <p className="foundations__muted">Loading…</p> : null}
      {error ? <p className="foundations__error">Could not load departments.</p> : null}

      <div className="foundations__table-wrap">
        <table className="foundations__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="foundations__empty">
                  No departments yet.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.name}</strong>
                  </td>
                  <td>{d.code}</td>
                  <td>
                    <div className="foundations__actions">
                      <button type="button" className="foundations__icon-btn" onClick={() => openEdit(d)} aria-label="Edit">
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        className="foundations__icon-btn foundations__icon-btn--danger"
                        disabled={deleting}
                        onClick={() => setPendingDelete(d)}
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
        title={editing ? "Edit department" : "Add department"}
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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CSE" />
          </label>
          <label className="foundations__field">
            <span>Code</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 101011" />
          </label>
          {formError ? <div className="foundations__error">{formError}</div> : null}
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete department"
        message={`Delete department "${pendingDelete?.name ?? ""}"? This may affect batches/courses.`}
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
