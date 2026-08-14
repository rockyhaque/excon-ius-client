import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "@/styles/overview.css";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { useGetSemestersQuery, useCreateSemesterMutation } from "@/redux/features/foundations/foundations.api";
import {
  useGetExamsQuery,
  useGenerateExamRoutineMutation,
  useUpdateExamMutation,
  useDeleteExamMutation,
} from "@/redux/features/exam-room/examRoom.api";
import { deptsOf, downloadCsv, stampName, timetableCsv } from "@/utils/exports";

const s = (v: unknown) => (v == null ? "" : String(v));
const arr = (x: unknown): Record<string, unknown>[] => {
  if (Array.isArray(x)) return x as Record<string, unknown>[];
  const d = (x as { data?: unknown } | undefined)?.data;
  return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
};
const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" });
};
const fmtTime = (v: string) => (v ? v.slice(0, 5) : "—");
const esc = (v: unknown) => s(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

type ExamType = "MIDTERM" | "FINAL";
type ExamRow = {
  id: string;
  course_code: string;
  course_name: string;
  dept: string;
  batch: string;
  section: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  status: string;
  exam_type: string;
  expected_students: number | null;
  room_name: string;
  room_building: string;
  room_capacity: number | null;
};
type Semester = { id: string; name: string; season: string; year: string };

export function ExamRoutinePanel() {
  const { data: semRaw } = useGetSemestersQuery();
  const semesters = useMemo<Semester[]>(
    () => arr(semRaw).map((x) => ({ id: s(x.id), name: s(x.name), season: s(x.season), year: s(x.year) })),
    [semRaw],
  );

  const [semesterId, setSemesterId] = useState("");
  const [viewType, setViewType] = useState<ExamType | "">("");
  const [deptFilter, setDeptFilter] = useState("");

  useEffect(() => {
    if (!semesterId && semesters.length > 0) {
      const current = arr(semRaw).find((x) => x.is_current);
      setSemesterId(current ? s(current.id) : semesters[0]!.id);
    }
  }, [semesters, semRaw, semesterId]);

  const { data: examsRaw, isLoading, error } = useGetExamsQuery(
    semesterId
      ? { semester_id: semesterId, limit: 500, ...(viewType ? { exam_type: viewType } : {}) }
      : undefined,
    { skip: !semesterId },
  );

  const rows = useMemo<ExamRow[]>(
    () =>
      arr(examsRaw).map((e) => ({
        id: s(e.id),
        course_code: s(e.course_code),
        course_name: s(e.course_name),
        dept: s(e.dept),
        batch: s(e.batch),
        section: s(e.section),
        exam_date: s(e.exam_date).slice(0, 10),
        start_time: s(e.start_time),
        end_time: s(e.end_time),
        status: s(e.status),
        exam_type: s(e.exam_type),
        expected_students: e.expected_students == null ? null : Number(e.expected_students),
        room_name: s(e.room_name),
        room_building: s(e.room_building),
        room_capacity: e.room_capacity == null ? null : Number(e.room_capacity),
      })),
    [examsRaw],
  );

  const deptOptions = useMemo(() => deptsOf(rows), [rows]);
  const viewRows = useMemo(
    () => (deptFilter ? rows.filter((r) => r.dept === deptFilter) : rows),
    [rows, deptFilter],
  );

  const groups = useMemo(() => {
    const m = new Map<string, ExamRow[]>();
    viewRows.forEach((r) => {
      const g = m.get(r.exam_date) ?? [];
      g.push(r);
      m.set(r.exam_date, g);
    });
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([date, list]) =>
          [
            date,
            list.sort(
              (a, b) =>
                a.start_time.localeCompare(b.start_time) ||
                a.dept.localeCompare(b.dept) ||
                a.batch.localeCompare(b.batch),
            ),
          ] as const,
      );
  }, [viewRows]);

  const statusCounts = useMemo(() => {
    const c = { SCHEDULED: 0, RESCHEDULED: 0, PENDING: 0, CANCELLED: 0 } as Record<string, number>;
    viewRows.forEach((r) => {
      const st = (r.status || "").toUpperCase();
      if (st in c) c[st]++;
    });
    return c;
  }, [viewRows]);
  const deptsCovered = useMemo(() => new Set(viewRows.map((r) => r.dept).filter(Boolean)).size, [viewRows]);
  const roomsSeated = useMemo(() => viewRows.filter((r) => r.room_name).length, [viewRows]);

  const [generate, { isLoading: generating }] = useGenerateExamRoutineMutation();
  const [createSemester] = useCreateSemesterMutation();
  const [updateExam, { isLoading: saving }] = useUpdateExamMutation();
  const [deleteExam, { isLoading: deleting }] = useDeleteExamMutation();

  const [genOpen, setGenOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [genSem, setGenSem] = useState("");
  const [examType, setExamType] = useState<ExamType>("MIDTERM");
  const [newName, setNewName] = useState("");
  const [newSeason, setNewSeason] = useState("FALL");
  const [newYear, setNewYear] = useState(2026);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [studentsPerSection, setStudentsPerSection] = useState(40);
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [replace, setReplace] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const openGenerate = () => {
    setMode(semesters.length ? "existing" : "new");
    setGenSem(semesterId || semesters[0]?.id || "");
    setExamType((viewType as ExamType) || "MIDTERM");
    setNewName("");
    setNewSeason("FALL");
    setNewYear(2026);
    setStartDate("");
    setEndDate("");
    setStartTime("09:00");
    setEndTime("12:00");
    setStudentsPerSection(40);
    setSkipWeekends(true);
    setReplace(false);
    setGenError(null);
    setGenOpen(true);
  };

  const submitGenerate = async () => {
    setGenError(null);
    if (!startDate || !endDate || !startTime || !endTime) return setGenError("Date range and time slot are required.");
    if (endDate < startDate) return setGenError("End date must be on or after start date.");
    if (!Number.isFinite(studentsPerSection) || studentsPerSection < 1) {
      return setGenError("Students per section must be at least 1.");
    }
    try {
      let sid = genSem;
      if (mode === "new") {
        if (!newName.trim()) return setGenError("New semester name is required.");
        const created = await createSemester({
          name: newName.trim(),
          season: newSeason,
          year: Number(newYear),
        }).unwrap();
        sid = s((created as Record<string, unknown>).id);
      }
      if (!sid) return setGenError("Please choose or create a semester.");
      const res = await generate({
        semester_id: sid,
        exam_type: examType,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
        skip_weekends: skipWeekends,
        replace,
        students_per_section: studentsPerSection,
      }).unwrap();
      setSemesterId(sid);
      setViewType(examType);
      setGenOpen(false);
      toast.success(res.message ?? "Exam routine generated.");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not generate routine.");
      setGenError(msg);
      toast.error(msg);
    }
  };

  const [editing, setEditing] = useState<ExamRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ExamRow | null>(null);
  const [eDate, setEDate] = useState("");
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");
  const [eStatus, setEStatus] = useState("SCHEDULED");
  const [editError, setEditError] = useState<string | null>(null);

  const openEdit = (r: ExamRow) => {
    setEditing(r);
    setEDate(r.exam_date);
    setEStart(r.start_time.slice(0, 5));
    setEEnd(r.end_time.slice(0, 5));
    setEStatus(r.status || "SCHEDULED");
    setEditError(null);
  };

  const submitEdit = async () => {
    if (!editing) return;
    setEditError(null);
    if (!eDate || !eStart || !eEnd) return setEditError("Date, start and end time are required.");
    try {
      await updateExam({
        id: editing.id,
        data: { exam_date: eDate, start_time: eStart, end_time: eEnd, status: eStatus },
      }).unwrap();
      setEditing(null);
      toast.success("Exam updated.");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not update exam.");
      setEditError(msg);
      toast.error(msg);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteExam(pendingDelete.id).unwrap();
      toast.success("Exam deleted.");
      setPendingDelete(null);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not delete exam."));
    }
  };

  const exportPdf = () => {
    const sem = semesters.find((x) => x.id === semesterId);
    const heading = `${sem ? esc(sem.name) : "Exam Routine"}${viewType ? ` · ${viewType}` : ""}`;
    const body = groups
      .map(([date, list]) => {
        const trs = list
          .map(
            (r) => `<tr>
              <td>${fmtTime(r.start_time)}–${fmtTime(r.end_time)}</td>
              <td>${esc(r.dept)}</td>
              <td>B${esc(r.batch)}${r.section ? "-" + esc(r.section) : ""}</td>
              <td><strong>${esc(r.course_code)}</strong> ${esc(r.course_name)}</td>
              <td>${esc(r.room_name || "—")}${r.room_building ? " (" + esc(r.room_building) + ")" : ""}</td>
              <td>${esc(r.exam_type || "—")}</td>
              <td>${esc(r.status)}</td>
            </tr>`,
          )
          .join("");
        return `<section><h2>${esc(fmtDay(date))}</h2>
          <table><thead><tr><th>Time</th><th>Department</th><th>Batch</th><th>Course</th><th>Room</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>${trs}</tbody></table></section>`;
      })
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${heading} — Exam Routine</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #111827; padding: 28px; }
        h1 { margin: 0 0 2px; font-size: 20px; }
        .meta { color: #6b7280; font-size: 12px; margin-bottom: 18px; }
        section { margin-bottom: 16px; page-break-inside: avoid; }
        h2 { font-size: 13px; margin: 0 0 6px; padding: 6px 10px; background: #f3f4f6; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
        th { background: #fafafa; font-weight: 700; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>
        <h1>University of Scholars — Exam Routine</h1>
        <div class="meta">${heading}${deptFilter ? " · " + esc(deptFilter) : ""} · ${viewRows.length} exam(s) · Generated ${esc(new Date().toLocaleDateString())}</div>
        ${body || "<p>No exams to print.</p>"}
        <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) return toast.error("Pop-up blocked — allow pop-ups to export the PDF.");
    w.document.write(html);
    w.document.close();
  };

  const exportCsv = () => {
    if (viewRows.length === 0) return toast.error("No exams to export.");
    const { header, rows: body } = timetableCsv(viewRows);
    downloadCsv(stampName(deptFilter ? `Exam_Timetable_${deptFilter}` : "Exam_Timetable", "csv"), header, body);
    toast.success("Timetable exported.");
  };

  return (
    <>
      <div className="foundations__toolbar">
        <div className="foundations__toolbar-left">
          <h2 className="foundations__h2" style={{ margin: 0 }}>
            Exam routine
          </h2>
        </div>
        <div className="foundations__toolbar-right">
          <select
            className="foundations__filter-control"
            value={semesterId}
            onChange={(e) => setSemesterId(e.target.value)}
            aria-label="Semester"
          >
            {semesters.length === 0 ? <option value="">No semesters</option> : null}
            {semesters.map((sm) => (
              <option key={sm.id} value={sm.id}>
                {sm.name}
              </option>
            ))}
          </select>
          <select
            className="foundations__filter-control"
            value={viewType}
            onChange={(e) => setViewType(e.target.value as ExamType | "")}
            aria-label="Exam type filter"
          >
            <option value="">All types</option>
            <option value="MIDTERM">Midterm</option>
            <option value="FINAL">Final</option>
          </select>
          <select
            className="foundations__filter-control"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            aria-label="Department filter"
          >
            <option value="">All departments</option>
            {deptOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button className="foundations__btn foundations__btn--ghost" type="button" onClick={exportPdf} disabled={viewRows.length === 0}>
            Export PDF
          </button>
          <button className="foundations__btn foundations__btn--ghost" type="button" onClick={exportCsv} disabled={viewRows.length === 0}>
            Export CSV
          </button>
          <button className="foundations__btn" type="button" onClick={openGenerate} disabled={generating}>
            {generating ? "Generating…" : "Generate routine"}
          </button>
        </div>
      </div>

      {isLoading ? <p className="foundations__muted">Loading…</p> : null}
      {error ? <p className="foundations__error">Could not load the routine.</p> : null}
      {!isLoading && semesterId && rows.length === 0 ? (
        <div className="foundations__empty" style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
          No exams for this filter yet. Click “Generate routine” (pick Midterm or Final).
        </div>
      ) : null}

      {!isLoading && rows.length > 0 && viewRows.length === 0 ? (
        <div className="foundations__empty" style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
          No exams for {deptFilter}. Choose another department.
        </div>
      ) : null}

      {viewRows.length > 0 ? (
        <>
          <div className="ov-kpis" style={{ marginBottom: 16 }}>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Total exams</div>
              <div className="ov-kpi__value">{viewRows.length.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Exam days</div>
              <div className="ov-kpi__value">{groups.length.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Departments</div>
              <div className="ov-kpi__value">{deptsCovered.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Rooms seated</div>
              <div className="ov-kpi__value">{roomsSeated.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Cancelled / Rescheduled</div>
              <div className="ov-kpi__value">{(statusCounts.CANCELLED + statusCounts.RESCHEDULED).toLocaleString()}</div>
            </div>
          </div>

          {groups.map(([date, list]) => (
            <div key={date} style={{ marginBottom: 14 }}>
              <div className="routine__date" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span>{fmtDay(date)}</span>
                <span className="foundations__badge">
                  {list.length} exam{list.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="foundations__table-wrap">
                <table className="foundations__table">
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Time</th>
                      <th style={{ width: 90 }}>Type</th>
                      <th>Department</th>
                      <th style={{ width: 90 }}>Batch</th>
                      <th>Course</th>
                      <th>Room</th>
                      <th style={{ width: 70 }}>Students</th>
                      <th style={{ width: 110 }}>Status</th>
                      <th style={{ width: 100 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {fmtTime(r.start_time)}–{fmtTime(r.end_time)}
                        </td>
                        <td>{r.exam_type || "—"}</td>
                        <td>{r.dept || "—"}</td>
                        <td>
                          B{r.batch}
                          {r.section ? `-${r.section}` : ""}
                        </td>
                        <td>
                          <strong>{r.course_code}</strong>{" "}
                          <span className="foundations__muted" style={{ margin: 0 }}>
                            {r.course_name}
                          </span>
                        </td>
                        <td>
                          {r.room_name ? (
                            <>
                              <strong>{r.room_name}</strong>
                              {r.room_building ? (
                                <span className="foundations__muted" style={{ margin: 0 }}>
                                  {" "}
                                  · {r.room_building}
                                  {r.room_capacity != null ? ` (${r.room_capacity})` : ""}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="foundations__muted">Unassigned</span>
                          )}
                        </td>
                        <td>{r.expected_students ?? "—"}</td>
                        <td>
                          <span className={`foundations__badge ${r.status === "CANCELLED" ? "foundations__badge--danger" : ""}`}>
                            {r.status || "—"}
                          </span>
                        </td>
                        <td>
                          <div className="foundations__actions">
                            <button type="button" className="foundations__icon-btn" onClick={() => openEdit(r)} aria-label="Edit">
                              <IconEdit />
                            </button>
                            <button
                              type="button"
                              className="foundations__icon-btn foundations__icon-btn--danger"
                              disabled={deleting}
                              onClick={() => setPendingDelete(r)}
                              aria-label="Delete"
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      ) : null}

      <Modal
        open={genOpen}
        title="Generate exam routine"
        width={560}
        onClose={() => setGenOpen(false)}
        footer={
          <div className="foundations__modal-actions">
            <button className="foundations__btn foundations__btn--ghost" type="button" onClick={() => setGenOpen(false)}>
              Cancel
            </button>
            <button className="foundations__btn" type="button" disabled={generating} onClick={() => void submitGenerate()}>
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
        }
      >
        <div className="foundations__form">
          <div className="foundations__tabs" style={{ margin: 0 }}>
            <button
              type="button"
              className={`foundations__tab ${mode === "existing" ? "foundations__tab--active" : ""}`}
              onClick={() => setMode("existing")}
            >
              Existing semester
            </button>
            <button
              type="button"
              className={`foundations__tab ${mode === "new" ? "foundations__tab--active" : ""}`}
              onClick={() => setMode("new")}
            >
              New semester
            </button>
          </div>

          {mode === "existing" ? (
            <label className="foundations__field">
              <span>Semester (Spring / Fall)</span>
              <select value={genSem} onChange={(e) => setGenSem(e.target.value)}>
                {semesters.length === 0 ? <option value="">No semesters — create one</option> : null}
                {semesters.map((sm) => (
                  <option key={sm.id} value={sm.id}>
                    {sm.name} ({sm.season})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="foundations__form" style={{ gap: 12 }}>
              <label className="foundations__field">
                <span>New semester name</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Fall 2026" />
              </label>
              <label className="foundations__field">
                <span>Season</span>
                <select value={newSeason} onChange={(e) => setNewSeason(e.target.value)}>
                  <option value="SPRING">Spring</option>
                  <option value="SUMMER">Summer</option>
                  <option value="FALL">Fall</option>
                </select>
              </label>
              <label className="foundations__field">
                <span>Year</span>
                <input type="number" value={newYear} onChange={(e) => setNewYear(Number(e.target.value))} min={2020} max={2100} />
              </label>
            </div>
          )}

          <label className="foundations__field">
            <span>Exam type</span>
            <select value={examType} onChange={(e) => setExamType(e.target.value as ExamType)}>
              <option value="MIDTERM">Midterm</option>
              <option value="FINAL">Final</option>
            </select>
          </label>

          <label className="foundations__field">
            <span>Start date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="foundations__field">
            <span>End date</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className="foundations__field">
            <span>Daily start time</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="foundations__field">
            <span>Daily end time</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
          <label className="foundations__field">
            <span>Students per section (for room seating)</span>
            <input
              type="number"
              min={1}
              value={studentsPerSection}
              onChange={(e) => setStudentsPerSection(Number(e.target.value))}
            />
          </label>

          <p className="foundations__muted" style={{ margin: 0 }}>
            Rooms are seated by capacity automatically. Teacher invigilation stays in Allocations — not mixed here.
          </p>

          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={skipWeekends} onChange={(e) => setSkipWeekends(e.target.checked)} />
            <span className="foundations__muted" style={{ margin: 0 }}>
              Skip weekends (Friday &amp; Saturday)
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            <span className="foundations__muted" style={{ margin: 0 }}>
              Replace this semester’s existing {examType} exams
            </span>
          </label>

          {genError ? <div className="foundations__error">{genError}</div> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Edit exam"
        onClose={() => setEditing(null)}
        footer={
          <div className="foundations__modal-actions">
            <button className="foundations__btn foundations__btn--ghost" type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="foundations__btn" type="button" disabled={saving} onClick={() => void submitEdit()}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        {editing ? (
          <div className="foundations__form">
            <div className="foundations__muted" style={{ marginTop: 0 }}>
              {editing.course_code} · {editing.dept} · B{editing.batch}
              {editing.section ? `-${editing.section}` : ""} · {editing.exam_type || "—"}
              {editing.room_name ? ` · ${editing.room_name}` : ""}
            </div>
            <label className="foundations__field">
              <span>Exam date</span>
              <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
            </label>
            <label className="foundations__field">
              <span>Start time</span>
              <input type="time" value={eStart} onChange={(e) => setEStart(e.target.value)} />
            </label>
            <label className="foundations__field">
              <span>End time</span>
              <input type="time" value={eEnd} onChange={(e) => setEEnd(e.target.value)} />
            </label>
            <label className="foundations__field">
              <span>Status</span>
              <select value={eStatus} onChange={(e) => setEStatus(e.target.value)}>
                <option value="SCHEDULED">Scheduled</option>
                <option value="RESCHEDULED">Rescheduled</option>
                <option value="PENDING">Pending</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            {editError ? <div className="foundations__error">{editError}</div> : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete exam"
        message={`Delete ${pendingDelete?.course_code ?? ""} (${pendingDelete?.dept ?? ""} B${pendingDelete?.batch ?? ""}${pendingDelete?.section ? "-" + pendingDelete.section : ""}) on ${pendingDelete?.exam_date ?? ""}?`}
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
