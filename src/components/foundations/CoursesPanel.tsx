import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getErrorMessage } from "@/utils/getErrorMessage";
import {
  useCreateCourseMutation,
  useDeleteCourseMutation,
  useGetBatchCoursesQuery,
  useGetBatchesQuery,
  useGetCoursesQuery,
  useGetDepartmentsQuery,
  useSetBatchCoursesMutation,
  useUpdateCourseMutation,
} from "@/redux/features/foundations/foundations.api";
import { mapBatches, mapCourses, mapDepartments } from "@/components/foundations/foundations.types";
import type { Course } from "@/types/foundations";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import { toast } from "react-toastify";

export function CoursesPanel() {
  const { data: departmentsRaw = [] } = useGetDepartmentsQuery({ limit: 100 });
  const { data: batchesRaw = [] } = useGetBatchesQuery({ limit: 100 });
  const { data: rowsRaw = [], isLoading, error } = useGetCoursesQuery({ limit: 100 });

  const deptOptions = useMemo(() => {
    const deps = mapDepartments(departmentsRaw);
    return deps.map((d) => ({ id: String(d.id), label: `${d.name} (${d.code})` }));
  }, [departmentsRaw]);

  const batches = useMemo(() => mapBatches(batchesRaw), [batchesRaw]);
  const allCourses = useMemo(() => mapCourses(rowsRaw), [rowsRaw]);

  // Filters (from Curriculum)
  const [filterDeptId, setFilterDeptId] = useState("");
  const [filterBatchId, setFilterBatchId] = useState("");

  useEffect(() => {
    if (!filterDeptId && deptOptions.length > 0) setFilterDeptId(deptOptions[0]!.id);
  }, [deptOptions, filterDeptId]);

  const deptBatches = useMemo(
    () => batches.filter((b) => !filterDeptId || String(b.dept_id) === filterDeptId),
    [batches, filterDeptId],
  );

  useEffect(() => {
    if (deptBatches.length === 0) {
      setFilterBatchId("");
      return;
    }
    if (!deptBatches.some((b) => String(b.id) === filterBatchId)) {
      setFilterBatchId(String(deptBatches[0]!.id));
    }
  }, [deptBatches, filterBatchId]);

  const filteredRows = useMemo(
    () => allCourses.filter((c) => !filterDeptId || String(c.dept_id) === filterDeptId),
    [allCourses, filterDeptId],
  );

  // Curriculum selection for the filtered batch
  const { data: currRaw, isFetching: loadingCurr } = useGetBatchCoursesQuery(filterBatchId, {
    skip: !filterBatchId,
  });
  const currIds = useMemo(
    () => new Set(((currRaw ?? []) as { id?: unknown }[]).map((c) => String(c.id))),
    [currRaw],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set(currIds));
  }, [currIds, filterBatchId]);

  const [saveCurriculum, { isLoading: savingCurr }] = useSetBatchCoursesMutation();

  const toggleCurr = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const setAllCurr = (on: boolean) =>
    setSelected(on ? new Set(filteredRows.map((c) => String(c.id))) : new Set());

  const dirty = useMemo(() => {
    if (selected.size !== currIds.size) return true;
    for (const id of selected) if (!currIds.has(id)) return true;
    return false;
  }, [selected, currIds]);

  const onSaveCurriculum = async () => {
    if (!filterBatchId) return;
    try {
      await saveCurriculum({ batchId: filterBatchId, course_ids: [...selected] }).unwrap();
      toast.success("Curriculum saved.");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not save curriculum."));
    }
  };

  // Course CRUD
  const [createCourse, { isLoading: creating }] = useCreateCourseMutation();
  const [updateCourse, { isLoading: updating }] = useUpdateCourseMutation();
  const [deleteCourse, { isLoading: deleting }] = useDeleteCourseMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Course | null>(null);
  const [formDeptId, setFormDeptId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormDeptId(filterDeptId || deptOptions[0]?.id || "");
    setName("");
    setCode("");
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (c: Course) => {
    setEditing(c);
    setFormDeptId(String(c.dept_id));
    setName(c.name);
    setCode(c.code);
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    if (!formDeptId || !name.trim() || !code.trim()) {
      setFormError("Department, course name and code are required.");
      return;
    }
    try {
      const payload = { dept_id: formDeptId, name: name.trim(), code: code.trim() };
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

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteCourse(pendingDelete.id).unwrap();
      toast.success("Course deleted.");
      setPendingDelete(null);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not delete course."));
    }
  };

  const batchLabel = (b: (typeof batches)[number]) => `Batch ${b.name ?? b.number}`;

  return (
    <>
      <div className="foundations__toolbar">
        <div className="foundations__toolbar-left">
          <h2 className="foundations__h2" style={{ margin: 0 }}>
            Courses
          </h2>
        </div>
        <div className="foundations__toolbar-right">
          <select
            className="foundations__filter-control"
            value={filterDeptId}
            onChange={(e) => setFilterDeptId(e.target.value)}
            aria-label="Filter by department"
            disabled={deptOptions.length === 0}
          >
            {deptOptions.length === 0 ? <option value="">No departments</option> : null}
            {deptOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <select
            className="foundations__filter-control"
            value={filterBatchId}
            onChange={(e) => setFilterBatchId(e.target.value)}
            aria-label="Filter by batch"
            disabled={deptBatches.length === 0}
          >
            {deptBatches.length === 0 ? <option value="">No batches</option> : null}
            {deptBatches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {batchLabel(b)}
              </option>
            ))}
          </select>
          <button className="foundations__btn" type="button" onClick={openCreate} disabled={deptOptions.length === 0}>
            + Add course
          </button>
        </div>
      </div>

      {filterBatchId ? (
        <div className="foundations__toolbar" style={{ marginTop: 0 }}>
          <div className="foundations__toolbar-left">
            <span className="foundations__muted" style={{ margin: 0 }}>
              {loadingCurr
                ? "Loading curriculum…"
                : `${selected.size} of ${filteredRows.length} course(s) in curriculum`}
            </span>
          </div>
          <div className="foundations__toolbar-right">
            <button type="button" className="foundations__btn foundations__btn--ghost" onClick={() => setAllCurr(true)} disabled={filteredRows.length === 0}>
              Select all
            </button>
            <button type="button" className="foundations__btn foundations__btn--ghost" onClick={() => setAllCurr(false)}>
              Clear
            </button>
            <button
              type="button"
              className="foundations__btn"
              onClick={() => void onSaveCurriculum()}
              disabled={savingCurr || !dirty || !filterBatchId}
            >
              {savingCurr ? "Saving…" : dirty ? "Save curriculum" : "Saved"}
            </button>
          </div>
        </div>
      ) : null}

      {isLoading ? <p className="foundations__muted">Loading…</p> : null}
      {error ? <p className="foundations__error">Could not load courses.</p> : null}
      {deptOptions.length === 0 ? <p className="foundations__muted">Create a department first.</p> : null}

      <div className="foundations__table-wrap">
        <table className="foundations__table">
          <thead>
            <tr>
              {filterBatchId ? <th style={{ width: 56 }}>In curriculum</th> : null}
              <th>Department</th>
              <th>Name</th>
              <th>Code</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={filterBatchId ? 5 : 4} className="foundations__empty">
                  No courses yet.
                </td>
              </tr>
            ) : (
              filteredRows.map((c) => {
                const id = String(c.id);
                return (
                  <tr key={c.id}>
                    {filterBatchId ? (
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(id)}
                          onChange={() => toggleCurr(id)}
                          aria-label={`Include ${c.code} in curriculum`}
                        />
                      </td>
                    ) : null}
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
                          onClick={() => setPendingDelete(c)}
                          aria-label="Delete"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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
            <select value={formDeptId} onChange={(e) => setFormDeptId(e.target.value)}>
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

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete course"
        message={`Delete course "${pendingDelete?.name ?? ""}"?`}
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
