import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { getErrorMessage } from "@/utils/getErrorMessage";
import {
  useCreateCourseMutation,
  useDeleteCourseMutation,
  useGetCoursesQuery,
  useGetDepartmentsQuery,
  useUpdateCourseMutation,
} from "@/redux/features/foundations/foundations.api";
import { mapCourses, mapDepartments } from "@/components/foundations/foundations.types";
import type { Course } from "@/types/foundations";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import { toast } from "react-toastify";

export function CoursesPanel() {
  const { data: departmentsRaw = [] } = useGetDepartmentsQuery();
  const { data: rowsRaw = [], isLoading, error } = useGetCoursesQuery();

  const deptOptions = useMemo(() => {
    const deps = mapDepartments(departmentsRaw);
    return deps.map((d) => ({ id: d.id, label: `${d.name} (${d.code})` }));
  }, [departmentsRaw]);

  const rows = mapCourses(rowsRaw);

  const [createCourse, { isLoading: creating }] = useCreateCourseMutation();
  const [updateCourse, { isLoading: updating }] = useUpdateCourseMutation();
  const [deleteCourse, { isLoading: deleting }] = useDeleteCourseMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deptId, setDeptId] = useState<string>("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (deptOptions.length > 0 && !deptId) setDeptId(String(deptOptions[0]!.id));
  }, [deptId, deptOptions]);

  const openCreate = () => {
    setEditing(null);
    setDeptId(String(deptOptions[0]?.id ?? ""));
    setName("");
    setCode("");
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (c: Course) => {
    setEditing(c);
    setDeptId(String(c.dept_id));
    setName(c.name);
    setCode(c.code);
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    if (!deptId || !name.trim() || !code.trim()) {
      setFormError("Department, course name and code are required.");
      return;
    }
    try {
      const payload = { dept_id: deptId, name: name.trim(), code: code.trim() };
      if (editing) await updateCourse({ id: editing.id, data: payload }).unwrap();
      else await createCourse(payload).unwrap();
      setOpen(false);
      toast.success(editing ? "Course updated." : "Course created.");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not save course.");
      setFormError(msg);
      toast.error(msg);
    }
  };

  const onDelete = async (c: Course) => {
    if (!window.confirm(`Delete course "${c.name}"?`)) return;
    try {
      await deleteCourse(c.id).unwrap();
      toast.success("Course deleted.");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not delete course."));
    }
  };

  return (
    <>
      <div className="foundations__toolbar">
        <div className="foundations__toolbar-left">
          <h2 className="foundations__h2" style={{ margin: 0 }}>
            Courses
          </h2>
          <span className="foundations__muted" style={{ margin: 0 }}>
            Courses belong to a department.
          </span>
        </div>
        <div className="foundations__toolbar-right">
          {deptOptions.length === 0 ? <span className="foundations__muted">Create a department first.</span> : null}
          <button className="foundations__btn" type="button" onClick={openCreate} disabled={deptOptions.length === 0}>
            + Add course
          </button>
        </div>
      </div>

      {isLoading ? <p className="foundations__muted">Loading…</p> : null}
      {error ? <p className="foundations__error">Could not load courses.</p> : null}

      <div className="foundations__table-wrap">
        <table className="foundations__table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Name</th>
              <th>Code</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="foundations__empty">
                  No courses yet.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.dept_name || "—"}</td>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{c.code}</td>
                  <td>
                    <div className="foundations__actions">
                      <button type="button" className="foundations__icon-btn" onClick={() => openEdit(c)} aria-label="Edit">
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        className="foundations__icon-btn foundations__icon-btn--danger"
                        disabled={deleting}
                        onClick={() => void onDelete(c)}
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
        title={editing ? "Edit course" : "Add course"}
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
            <span>Department</span>
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="foundations__field">
            <span>Course name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Data Structures" />
          </label>
          <label className="foundations__field">
            <span>Course code</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CSE2201" />
          </label>
          {formError ? <div className="foundations__error">{formError}</div> : null}
        </div>
      </Modal>
    </>
  );
}

