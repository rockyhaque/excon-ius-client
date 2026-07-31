import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "@/styles/overview.css";
import { Modal } from "@/components/ui/Modal";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import { AreaChart, ChartCard, DonutChart, HBarList, VIZ } from "@/components/overview/charts";
import { bucketByDate, countBy, isUpcoming } from "@/utils/stats";
import { getErrorMessage } from "@/utils/getErrorMessage";
import {
  useCreateExamMutation,
  useDeleteExamMutation,
  useGetExamsQuery,
  useUpdateExamMutation,
} from "@/redux/features/exam-room/examRoom.api";
import { mapExams } from "@/components/exam-room/examRoom.types";
import type { Exam } from "@/types/examRoom";
import {
  useGetBatchesQuery,
  useGetCoursesQuery,
  useGetDepartmentsQuery,
  useGetSectionsQuery,
} from "@/redux/features/foundations/foundations.api";
import { mapBatches, mapCourses, mapDepartments, mapSections } from "@/components/foundations/foundations.types";

type Option = { id: string; label: string };

export function ExamsPanel() {
  const { data: rowsRaw = [], isLoading, error } = useGetExamsQuery({ limit: 100 });
  const rows = useMemo(() => mapExams(rowsRaw), [rowsRaw]);

  // ── Stats & chart data ────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const c = { SCHEDULED: 0, RESCHEDULED: 0, PENDING: 0, CANCELLED: 0 } as Record<string, number>;
    rows.forEach((e) => {
      const st = (e.status || "").toUpperCase();
      if (st in c) c[st]++;
    });
    return c;
  }, [rows]);

  const upcomingCount = useMemo(() => rows.filter((e) => isUpcoming(e.exam_date)).length, [rows]);
  const deptsCovered = useMemo(() => new Set(rows.map((e) => e.dept).filter(Boolean)).size, [rows]);
  const scheduleDensity = useMemo(() => bucketByDate(rows, (e) => e.exam_date, 20), [rows]);
  const examsByDept = useMemo(() => countBy(rows, (e) => e.dept, 8), [rows]);
  const statusSlices = useMemo(
    () => [
      { label: "Scheduled", value: statusCounts.SCHEDULED, color: VIZ.blue },
      { label: "Rescheduled", value: statusCounts.RESCHEDULED, color: VIZ.warning },
      { label: "Pending", value: statusCounts.PENDING, color: VIZ.neutral },
      { label: "Cancelled", value: statusCounts.CANCELLED, color: VIZ.critical },
    ],
    [statusCounts],
  );

  const { data: depsRaw = [] } = useGetDepartmentsQuery({ limit: 100 });
  const { data: batchesRaw = [] } = useGetBatchesQuery({ limit: 100 });
  const { data: sectionsRaw = [] } = useGetSectionsQuery({ limit: 100 });
  const { data: coursesRaw = [] } = useGetCoursesQuery({ limit: 100 });

  const deps = useMemo(() => mapDepartments(depsRaw), [depsRaw]);
  const batches = useMemo(() => mapBatches(batchesRaw), [batchesRaw]);
  const sections = useMemo(() => mapSections(sectionsRaw), [sectionsRaw]);
  const courses = useMemo(() => mapCourses(coursesRaw), [coursesRaw]);

  const deptOptions: Option[] = useMemo(
    () => deps.map((d) => ({ id: String(d.id), label: `${d.name} (${d.code})` })),
    [deps]
  );

  const [createExam, { isLoading: creating }] = useCreateExamMutation();
  const [updateExam, { isLoading: updating }] = useUpdateExamMutation();
  const [deleteExam, { isLoading: deleting }] = useDeleteExamMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [deptId, setDeptId] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [courseId, setCourseId] = useState<string>("");
  const [examDate, setExamDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const batchOptions: Option[] = useMemo(() => {
    const filtered = deptId ? batches.filter((b) => String(b.dept_id) === deptId) : batches;
    return filtered.map((b) => ({ id: String(b.id), label: String(b.name ?? b.number ?? "—") }));
  }, [batches, deptId]);

  const sectionOptions: Option[] = useMemo(() => {
    const filtered = batchId ? sections.filter((s) => String(s.batch_id) === batchId) : sections;
    return filtered.map((s) => ({ id: String(s.id), label: s.name }));
  }, [sections, batchId]);

  const courseOptions: Option[] = useMemo(() => {
    const filtered = deptId ? courses.filter((c) => String(c.dept_id) === deptId) : courses;
    return filtered.map((c) => ({ id: String(c.id), label: `${c.code} · ${c.name}` }));
  }, [courses, deptId]);

  useEffect(() => {
    if (deptOptions.length > 0 && !deptId) setDeptId(deptOptions[0]!.id);
  }, [deptId, deptOptions]);

  useEffect(() => {
    if (batchOptions.length > 0 && !batchId) setBatchId(batchOptions[0]!.id);
  }, [batchId, batchOptions]);

  useEffect(() => {
    if (sectionOptions.length > 0 && !sectionId) setSectionId(sectionOptions[0]!.id);
  }, [sectionId, sectionOptions]);

  useEffect(() => {
    if (courseOptions.length > 0 && !courseId) setCourseId(courseOptions[0]!.id);
  }, [courseId, courseOptions]);

  const openCreate = () => {
    setEditing(null);
    setDeptId(deptOptions[0]?.id ?? "");
    setBatchId("");
    setSectionId("");
    setCourseId("");
    setExamDate("");
    setStartTime("");
    setEndTime("");
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (e: Exam) => {
    setEditing(e);
    setDeptId(String(e.dept_id));
    setBatchId(String(e.batch_id));
    setSectionId(String(e.section_id));
    setCourseId(String(e.course_id));
    setExamDate((e.exam_date || "").slice(0, 10));
    setStartTime((e.start_time || "").slice(0, 5));
    setEndTime((e.end_time || "").slice(0, 5));
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);

    if (!deptId || !batchId || !sectionId || !courseId || !examDate || !startTime || !endTime) {
      setFormError("Department, batch, section, course, date, start time, and end time are required.");
      return;
    }

    const dep = deps.find((d) => String(d.id) === deptId);
    const batch = batches.find((b) => String(b.id) === batchId);
    const section = sections.find((s) => String(s.id) === sectionId);
    const course = courses.find((c) => String(c.id) === courseId);

    if (!dep || !batch || !section || !course) {
      setFormError("Please select valid department, batch, section and course.");
      return;
    }

    const payload = {
      dept_id: dep.id,
      dept: dep.name,
      batch_id: batch.id,
      batch: String(batch.name ?? batch.number ?? ""),
      section_id: section.id,
      section: section.name,
      course_id: course.id,
      course_name: course.name,
      course_code: course.code,
      exam_date: examDate,
      start_time: startTime,
      end_time: endTime,
    };

    try {
      if (editing) await updateExam({ id: editing.id, data: payload }).unwrap();
      else await createExam(payload).unwrap();
      setOpen(false);
      toast.success(editing ? "Exam updated." : "Exam created.");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not save exam.");
      setFormError(msg);
      toast.error(msg);
    }
  };

  const onDelete = async (e: Exam) => {
    if (!window.confirm(`Delete exam "${e.course_code}" on ${String(e.exam_date).slice(0, 10)}?`)) return;
    try {
      await deleteExam(e.id).unwrap();
      toast.success("Exam deleted.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Could not delete exam."));
    }
  };

  return (
    <>
      <div className="foundations__toolbar">
        <div className="foundations__toolbar-left">
          <h2 className="foundations__h2" style={{ margin: 0 }}>
            Exams
          </h2>
          <span className="foundations__muted" style={{ margin: 0 }}>
            Create and manage exams (course + batch/section + time).
          </span>
        </div>
        <div className="foundations__toolbar-right">
          {deptOptions.length === 0 ? <span className="foundations__muted">Create foundations first.</span> : null}
          <button className="foundations__btn" type="button" onClick={openCreate} disabled={deptOptions.length === 0}>
            + Add exam
          </button>
        </div>
      </div>

      {isLoading ? <p className="foundations__muted">Loading…</p> : null}
      {error ? <p className="foundations__error">Could not load exams.</p> : null}

      {rows.length > 0 ? (
        <>
          <div className="ov-kpis" style={{ marginBottom: 16 }}>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Total exams</div>
              <div className="ov-kpi__value">{rows.length.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Upcoming</div>
              <div className="ov-kpi__value">{upcomingCount.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Cancelled</div>
              <div className="ov-kpi__value">{statusCounts.CANCELLED.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Departments covered</div>
              <div className="ov-kpi__value">{deptsCovered.toLocaleString()}</div>
            </div>
          </div>

          <div className="ov-grid" style={{ marginBottom: 20 }}>
            <ChartCard title="Schedule density" subtitle="Exams scheduled per date" wide>
              <AreaChart data={scheduleDensity} />
            </ChartCard>
            <ChartCard title="Exam status" subtitle="Lifecycle of the current exams">
              <DonutChart centerLabel="exams" data={statusSlices} />
            </ChartCard>
            <ChartCard title="Exams per department" subtitle="Where the exam load sits">
              <HBarList data={examsByDept} unit="exams" />
            </ChartCard>
          </div>
        </>
      ) : null}

      <div className="foundations__table-wrap">
        <table className="foundations__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Course</th>
              <th>Dept</th>
              <th>Batch</th>
              <th>Section</th>
              <th style={{ width: 120 }}>Status</th>
              <th style={{ width: 90 }}>Students</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="foundations__empty">
                  No exams yet.
                </td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr key={e.id}>
                  <td>{String(e.exam_date).slice(0, 10) || "—"}</td>
                  <td>
                    {e.start_time?.slice(0, 5) || "—"} - {e.end_time?.slice(0, 5) || "—"}
                  </td>
                  <td>
                    <strong>{e.course_code || "—"}</strong>
                    <div className="foundations__muted" style={{ margin: 0 }}>
                      {e.course_name || ""}
                    </div>
                  </td>
                  <td>{e.dept || "—"}</td>
                  <td>{e.batch || "—"}</td>
                  <td>{e.section || "—"}</td>
                  <td>
                    <span className={`foundations__badge ${e.status.toUpperCase() === "CANCELLED" ? "foundations__badge--danger" : ""}`}>
                      {e.status || "—"}
                    </span>
                  </td>
                  <td>{e.expected_students == null ? "—" : e.expected_students}</td>
                  <td>
                    <div className="foundations__actions">
                      <button type="button" className="foundations__icon-btn" onClick={() => openEdit(e)} aria-label="Edit">
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        className="foundations__icon-btn foundations__icon-btn--danger"
                        disabled={deleting}
                        onClick={() => void onDelete(e)}
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
        title={editing ? "Edit exam" : "Add exam"}
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
            <select
              value={deptId}
              onChange={(e) => {
                const next = e.target.value;
                setDeptId(next);
                setBatchId("");
                setSectionId("");
                setCourseId("");
              }}
            >
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="foundations__field">
            <span>Batch</span>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={batchOptions.length === 0}>
              {batchOptions.length === 0 ? <option value="">No batches</option> : null}
              {batchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          <label className="foundations__field">
            <span>Section</span>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={sectionOptions.length === 0}>
              {sectionOptions.length === 0 ? <option value="">No sections</option> : null}
              {sectionOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="foundations__field">
            <span>Course</span>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={courseOptions.length === 0}>
              {courseOptions.length === 0 ? <option value="">No courses</option> : null}
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="foundations__field">
            <span>Exam date</span>
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </label>

          <label className="foundations__field">
            <span>Start time</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>

          <label className="foundations__field">
            <span>End time</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>

          {formError ? <div className="foundations__error">{formError}</div> : null}
        </div>
      </Modal>
    </>
  );
}

