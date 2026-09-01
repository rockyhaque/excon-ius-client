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
  useGetSemestersQuery,
  useGetCourseTypesQuery,
  useGetAcademicSettingsQuery,
  useOfferBatchCourseMutation,
  useUnofferBatchCourseMutation,
  useUpdateCourseMutation,
} from "@/redux/features/foundations/foundations.api";
import { batchOptionLabel, mapBatches, mapCourses, mapDepartments } from "@/components/foundations/foundations.types";
import type { Course } from "@/types/foundations";
import { MAX_SEMESTER_CREDITS } from "@/types/foundations";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import { toast } from "react-toastify";

export function CoursesPanel() {
  const { data: departmentsRaw = [] } = useGetDepartmentsQuery({ limit: 100 });
  const { data: batchesRaw = [] } = useGetBatchesQuery({ limit: 500 });
  const { data: semestersRaw = [] } = useGetSemestersQuery();

  // Credit rules are now data-driven (Foundations → Credits): the course-type list and the cap.
  const { data: courseTypesRaw = [] } = useGetCourseTypesQuery();
  const courseTypes = useMemo(
    () => (courseTypesRaw as Record<string, unknown>[]).map((t) => ({ code: String(t.code), name: String(t.name), credit: Number(t.credit) })),
    [courseTypesRaw],
  );
  const creditForCode = (c: string) => courseTypes.find((t) => t.code.toUpperCase() === String(c).toUpperCase())?.credit ?? 0;
  const typeName = (c: string) => courseTypes.find((t) => t.code.toUpperCase() === String(c).toUpperCase())?.name ?? String(c);
  const { data: acadSettings } = useGetAcademicSettingsQuery();
  const maxCredits = acadSettings?.max_semester_credits ?? MAX_SEMESTER_CREDITS;
  const [filterDeptId, setFilterDeptId] = useState("");
  const { data: catalogRaw = [], isLoading: loadingCatalog } = useGetCoursesQuery(
    { limit: 500, dept_id: filterDeptId },
    { skip: !filterDeptId },
  );

  const deptOptions = useMemo(() => {
    const deps = mapDepartments(departmentsRaw);
    return deps.map((d) => ({ id: String(d.id), label: `${d.name} (${d.code})` }));
  }, [departmentsRaw]);

  const batches = useMemo(() => mapBatches(batchesRaw), [batchesRaw]);
  const catalog = useMemo(() => mapCourses(catalogRaw), [catalogRaw]);

  const currentSemester = useMemo(() => {
    const rows = Array.isArray(semestersRaw) ? semestersRaw : [];
    const current = rows.find((s) => Boolean((s as { is_current?: unknown }).is_current));
    const pick = current ?? rows[0];
    if (!pick) return null;
    return { id: String(pick.id ?? ""), name: String(pick.name ?? "Current semester") };
  }, [semestersRaw]);

  const [filterBatchId, setFilterBatchId] = useState("");

  useEffect(() => {
    if (!filterDeptId && deptOptions.length > 0) setFilterDeptId(deptOptions[0]!.id);
  }, [deptOptions, filterDeptId]);

  const deptBatches = useMemo(
    () =>
      batches
        .filter((b) => !filterDeptId || String(b.dept_id) === filterDeptId)
        .sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [batches, filterDeptId],
  );

  useEffect(() => {
    if (deptBatches.length === 0) {
      setFilterBatchId("");
      return;
    }
    if (!deptBatches.some((b) => String(b.id) === filterBatchId)) {
      const running = deptBatches.find((b) => b.status !== "COMPLETED");
      setFilterBatchId(String((running ?? deptBatches[0]!).id));
    }
  }, [deptBatches, filterBatchId]);

  const { data: offeredRaw, isFetching: loadingOffered } = useGetBatchCoursesQuery(filterBatchId, {
    skip: !filterBatchId,
  });
  const offered = useMemo(() => mapCourses(offeredRaw ?? []), [offeredRaw]);
  const offeredIds = useMemo(() => new Set(offered.map((c) => String(c.id))), [offered]);
  const creditsUsed = useMemo(() => offered.reduce((sum, c) => sum + (c.credit || 0), 0), [offered]);

  const [createCourse, { isLoading: creating }] = useCreateCourseMutation();
  const [updateCourse, { isLoading: updating }] = useUpdateCourseMutation();
  const [deleteCourse, { isLoading: deleting }] = useDeleteCourseMutation();
  const [offerCourse, { isLoading: offering }] = useOfferBatchCourseMutation();
  const [unofferCourse, { isLoading: unoffering }] = useUnofferBatchCourseMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Course | null>(null);
  const [pendingUnoffer, setPendingUnoffer] = useState<Course | null>(null);
  const [formDeptId, setFormDeptId] = useState("");
  const [formBatchId, setFormBatchId] = useState("");
  const [formCourseId, setFormCourseId] = useState("");
  const [createNew, setCreateNew] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<string>("THEORY");
  const [formError, setFormError] = useState<string | null>(null);

  const formBatches = useMemo(
    () =>
      batches
        .filter((b) => String(b.dept_id) === formDeptId)
        .sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [batches, formDeptId],
  );

  const { data: formOfferedRaw } = useGetBatchCoursesQuery(formBatchId, { skip: !formBatchId || !open || Boolean(editing) });
  const formOffered = useMemo(() => mapCourses(formOfferedRaw ?? []), [formOfferedRaw]);
  const formCreditsUsed = useMemo(
    () => (formBatchId === filterBatchId ? creditsUsed : formOffered.reduce((sum, c) => sum + (c.credit || 0), 0)),
    [formBatchId, filterBatchId, creditsUsed, formOffered],
  );
  const formOfferedIds = useMemo(() => {
    if (formBatchId && formBatchId === filterBatchId) return offeredIds;
    return new Set(formOffered.map((c) => String(c.id)));
  }, [formBatchId, filterBatchId, offeredIds, formOffered]);

  const pickerCourses = useMemo(
    () => catalog.filter((c) => String(c.dept_id) === formDeptId && !formOfferedIds.has(String(c.id))),
    [catalog, formDeptId, formOfferedIds],
  );

  const selectedPicker = pickerCourses.find((c) => String(c.id) === formCourseId);
  const addCredit = createNew || editing ? creditForCode(kind) : selectedPicker?.credit || 0;
  const remaining = maxCredits - formCreditsUsed;
  const wouldExceed = !editing && addCredit > remaining;

  const openCreate = () => {
    setEditing(null);
    const dept = filterDeptId || deptOptions[0]?.id || "";
    setFormDeptId(dept);
    setFormBatchId(filterBatchId);
    setFormCourseId("");
    setCreateNew(false);
    setName("");
    setCode("");
    setKind(courseTypes[0]?.code ?? "THEORY");
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (c: Course) => {
    setEditing(c);
    setFormDeptId(String(c.dept_id));
    setFormBatchId(filterBatchId);
    setFormCourseId("");
    setCreateNew(false);
    setName(c.name);
    setCode(c.code);
    setKind(String(c.kind || courseTypes[0]?.code || "THEORY"));
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    if (editing) {
      if (!formDeptId || !name.trim() || !code.trim()) {
        setFormError("Department, course name and code are required.");
        return;
      }
      try {
        await updateCourse({
          id: editing.id,
          data: { dept_id: formDeptId, name: name.trim(), code: code.trim(), kind },
        }).unwrap();
        setOpen(false);
        toast.success("Course updated.");
      } catch (e: unknown) {
        const msg = getErrorMessage(e, "Could not save course.");
        setFormError(msg);
        toast.error(msg);
      }
      return;
    }

    if (!formDeptId || !formBatchId) {
      setFormError("Department and batch are required.");
      return;
    }
    if (!currentSemester?.id) {
      setFormError("Set a current semester in Foundations → Semesters first.");
      return;
    }
    if (wouldExceed) {
      setFormError(`This batch already has ${formCreditsUsed} credits. A student may take at most ${maxCredits} credits per semester.`);
      return;
    }

    try {
      if (createNew) {
        if (!name.trim() || !code.trim()) {
          setFormError("Course name and code are required.");
          return;
        }
        await createCourse({
          dept_id: formDeptId,
          name: name.trim(),
          code: code.trim(),
          kind,
          batch_id: formBatchId,
          semester_id: currentSemester.id,
        }).unwrap();
      } else {
        if (!formCourseId) {
          setFormError("Pick a course, or create a new one.");
          return;
        }
        await offerCourse({
          batchId: formBatchId,
          course_id: formCourseId,
          semester_id: currentSemester.id,
        }).unwrap();
      }
      setOpen(false);
      toast.success("Course added for this semester.");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not add course.");
      setFormError(msg);
      toast.error(msg);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteCourse(pendingDelete.id).unwrap();
      toast.success("Course deleted from catalog.");
      setPendingDelete(null);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not delete course."));
    }
  };

  const confirmUnoffer = async () => {
    if (!pendingUnoffer || !filterBatchId) return;
    try {
      await unofferCourse({
        batchId: filterBatchId,
        courseId: String(pendingUnoffer.id),
        semester_id: currentSemester?.id,
      }).unwrap();
      toast.success("Removed from this semester.");
      setPendingUnoffer(null);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not remove course."));
    }
  };

  const saving = creating || updating || offering;
  const selectedBatch = deptBatches.find((b) => String(b.id) === filterBatchId);

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
                {batchOptionLabel(b)}
              </option>
            ))}
          </select>
          <button
            className="foundations__btn"
            type="button"
            onClick={openCreate}
            disabled={deptOptions.length === 0 || !filterBatchId}
          >
            + Add course
          </button>
        </div>
      </div>

      {filterBatchId ? (
        <div className="foundations__toolbar" style={{ marginTop: 0 }}>
          <div className="foundations__toolbar-left">
            <span className="foundations__muted" style={{ margin: 0 }}>
              {currentSemester ? currentSemester.name : "No current semester"}
              {selectedBatch ? ` · ${batchOptionLabel(selectedBatch)}` : ""}
              {loadingOffered
                ? " · Loading…"
                : ` · ${creditsUsed} / ${maxCredits} credits this semester`}
            </span>
          </div>
        </div>
      ) : null}

      {loadingCatalog && !filterBatchId ? <p className="foundations__muted">Loading…</p> : null}
      {deptOptions.length === 0 ? <p className="foundations__muted">Create a department first.</p> : null}
      {!currentSemester ? (
        <p className="foundations__error">Set a current semester in Semesters before offering courses.</p>
      ) : null}

      <div className="foundations__table-wrap">
        <table className="foundations__table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Credits</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {offered.length === 0 ? (
              <tr>
                <td colSpan={5} className="foundations__empty">
                  {filterBatchId
                    ? "No courses offered to this batch this semester. Add them one by one."
                    : "Select a department and batch."}
                </td>
              </tr>
            ) : (
              offered.map((c) => (
                <tr key={c.id}>
                  <td>{c.code}</td>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{typeName(String(c.kind))}</td>
                  <td>{c.credit}</td>
                  <td>
                    <div className="foundations__actions">
                      <button type="button" className="foundations__icon-btn" onClick={() => openEdit(c)} aria-label="Edit">
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        className="foundations__icon-btn"
                        disabled={unoffering}
                        onClick={() => setPendingUnoffer(c)}
                        aria-label="Remove from this semester"
                        title="Remove from this semester"
                      >
                        ×
                      </button>
                      <button
                        type="button"
                        className="foundations__icon-btn foundations__icon-btn--danger"
                        disabled={deleting}
                        onClick={() => setPendingDelete(c)}
                        aria-label="Delete from catalog"
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
        title={editing ? "Edit course" : "Add course this semester"}
        onClose={() => setOpen(false)}
        footer={
          <div className="foundations__modal-actions">
            <button className="foundations__btn foundations__btn--ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="foundations__btn" type="button" disabled={saving} onClick={() => void submit()}>
              {saving ? "Saving…" : editing ? "Save" : "Add"}
            </button>
          </div>
        }
      >
        <div className="foundations__form">
          <label className="foundations__field">
            <span>Department</span>
            <select
              value={formDeptId}
              onChange={(e) => {
                const next = e.target.value;
                setFormDeptId(next);
                const nextBatches = batches.filter((b) => String(b.dept_id) === next);
                if (!nextBatches.some((b) => String(b.id) === formBatchId)) {
                  setFormBatchId(String(nextBatches[0]?.id ?? ""));
                }
                setFormCourseId("");
              }}
              disabled={Boolean(editing)}
            >
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          {!editing ? (
            <label className="foundations__field">
              <span>Batch</span>
              {formBatches.length === 0 ? (
                <p className="foundations__muted" style={{ margin: 0 }}>
                  No batches for this department — create them in <strong>Batches</strong> first.
                </p>
              ) : (
                <select value={formBatchId} onChange={(e) => { setFormBatchId(e.target.value); setFormCourseId(""); }}>
                  {formBatches.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {batchOptionLabel(b)}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ) : null}
          {currentSemester ? (
            <p className="foundations__muted" style={{ margin: 0 }}>
              Offering for <strong>{currentSemester.name}</strong>
              {!editing ? ` · ${formCreditsUsed} / ${maxCredits} credits used` : ""}
            </p>
          ) : null}

          {editing ? (
            <>
              <label className="foundations__field">
                <span>Course name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Data Structures" />
              </label>
              <label className="foundations__field">
                <span>Course code</span>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CSE-2215" />
              </label>
              <label className="foundations__field">
                <span>Type</span>
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  {courseTypes.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name} · {t.credit} {t.credit === 1 ? "credit" : "credits"}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="foundations__check-item" style={{ margin: 0 }}>
                <input type="checkbox" checked={createNew} onChange={(e) => { setCreateNew(e.target.checked); setFormCourseId(""); }} />
                <span>Create a new catalog course</span>
              </label>
              {createNew ? (
                <>
                  <label className="foundations__field">
                    <span>Course name</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Data Structures" />
                  </label>
                  <label className="foundations__field">
                    <span>Course code</span>
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CSE-2215" />
                  </label>
                  <label className="foundations__field">
                    <span>Type</span>
                    <select value={kind} onChange={(e) => setKind(e.target.value)}>
                      {courseTypes.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.name} · {t.credit} {t.credit === 1 ? "credit" : "credits"}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <label className="foundations__field">
                  <span>Course</span>
                  <select value={formCourseId} onChange={(e) => setFormCourseId(e.target.value)}>
                    <option value="">{pickerCourses.length === 0 ? "No remaining catalog courses" : "Select a course"}</option>
                    {pickerCourses.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.code} — {c.name} ({typeName(String(c.kind))} {c.credit} cr)
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {wouldExceed ? (
                <div className="foundations__error">
                  Adding this course would exceed {maxCredits} credits this semester.
                </div>
              ) : null}
            </>
          )}
          {formError ? <div className="foundations__error">{formError}</div> : null}
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(pendingUnoffer)}
        title="Remove from this semester"
        message={`Stop offering "${pendingUnoffer?.code ?? ""}" to this batch this semester? The catalog course stays.`}
        busy={unoffering}
        onClose={() => setPendingUnoffer(null)}
        onConfirm={() => void confirmUnoffer()}
      />

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete course"
        message={`Delete "${pendingDelete?.name ?? ""}" from the catalog? This removes it from every batch.`}
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
