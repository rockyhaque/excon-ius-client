import "@/styles/overview.css";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useGetExamsQuery } from "@/redux/features/exam-room/examRoom.api";
import { deptsOf, downloadCsv, stampName, timetableCsv } from "@/utils/exports";

const s = (v: unknown) => (v == null ? "" : String(v));
const arr = (x: unknown): Record<string, unknown>[] => {
  if (Array.isArray(x)) return x as Record<string, unknown>[];
  const d = (x as { data?: unknown } | undefined)?.data;
  return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
};
const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" });
};
const fmtTime = (v: string) => (v ? v.slice(0, 5) : "—");

type ScheduleRow = {
  id: string;
  semester_id: string;
  semester_name: string;
  course_code: string;
  course_name: string;
  dept: string;
  batch: string;
  section: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  exam_type: string;
  status: string;
  room_name: string;
  room_building: string;
  room_capacity: number | null;
  expected_students: number | null;
};

/**
 * Read-only exam timetable for faculty. Fetches the exam list (open to any authenticated user)
 * and derives the semester filter from the data — teachers don't have access to the admin-only
 * foundations/semesters endpoint.
 */
export function TeacherSchedulePanel() {
  const { data: examsRaw, isLoading, error } = useGetExamsQuery({ limit: 500 });

  const rows = useMemo<ScheduleRow[]>(
    () =>
      arr(examsRaw).map((e) => ({
        id: s(e.id),
        semester_id: s(e.semester_id),
        semester_name: s(e.semester_name) || s(e.semester),
        course_code: s(e.course_code),
        course_name: s(e.course_name),
        dept: s(e.dept),
        batch: s(e.batch),
        section: s(e.section),
        exam_date: s(e.exam_date).slice(0, 10),
        start_time: s(e.start_time),
        end_time: s(e.end_time),
        exam_type: s(e.exam_type),
        status: s(e.status),
        room_name: s(e.room_name),
        room_building: s(e.room_building),
        room_capacity: e.room_capacity == null ? null : Number(e.room_capacity),
        expected_students: e.expected_students == null ? null : Number(e.expected_students),
      })),
    [examsRaw],
  );

  // Semester options, derived from the exams themselves.
  const semesterOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => {
      if (r.semester_id) m.set(r.semester_id, r.semester_name || "Semester");
    });
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const [semesterId, setSemesterId] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  // Default to the semester of the most recent exam, once data arrives.
  useEffect(() => {
    if (semesterId || rows.length === 0) return;
    const latest = rows.reduce((a, b) => (a.exam_date >= b.exam_date ? a : b));
    if (latest.semester_id) setSemesterId(latest.semester_id);
  }, [rows, semesterId]);

  const viewRows = useMemo(
    () =>
      rows.filter(
        (r) => (!semesterId || r.semester_id === semesterId) && (!deptFilter || r.dept === deptFilter),
      ),
    [rows, semesterId, deptFilter],
  );

  const deptOptions = useMemo(() => deptsOf(rows.filter((r) => !semesterId || r.semester_id === semesterId)), [rows, semesterId]);

  const groups = useMemo(() => {
    const m = new Map<string, ScheduleRow[]>();
    viewRows.forEach((r) => {
      const g = m.get(r.exam_date) ?? [];
      g.push(r);
      m.set(r.exam_date, g);
    });
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, list]) => [date, list.sort((a, b) => a.start_time.localeCompare(b.start_time) || a.dept.localeCompare(b.dept))] as const);
  }, [viewRows]);

  const exportCsv = () => {
    if (viewRows.length === 0) return toast.error("No exams to export.");
    const { header, rows: body } = timetableCsv(viewRows);
    downloadCsv(stampName(deptFilter ? `Exam_Timetable_${deptFilter}` : "Exam_Timetable", "csv"), header, body);
    toast.success("Timetable exported.");
  };

  return (
    <div className="foundations">
      <div className="card foundations__card">
        <div className="foundations__toolbar">
          <div className="foundations__toolbar-left">
            <div>
              <h2 style={{ margin: 0 }}>Exam schedule</h2>
              <p className="foundations__lead" style={{ margin: "4px 0 0" }}>
                The published exam timetable. Read-only — your invigilation duties are under “My Allocation”.
              </p>
            </div>
          </div>
          <div className="foundations__toolbar-right">
            <select
              className="foundations__filter-control"
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
              aria-label="Semester"
            >
              <option value="">All semesters</option>
              {semesterOptions.map((sm) => (
                <option key={sm.id} value={sm.id}>
                  {sm.name}
                </option>
              ))}
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
            <button className="foundations__btn foundations__btn--ghost" type="button" onClick={exportCsv} disabled={viewRows.length === 0}>
              Export CSV
            </button>
          </div>
        </div>

        {isLoading ? <p className="foundations__muted">Loading…</p> : null}
        {error ? <p className="foundations__error">Could not load the exam schedule.</p> : null}
        {!isLoading && !error && viewRows.length === 0 ? (
          <div className="foundations__empty" style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
            No exams scheduled for this selection yet.
          </div>
        ) : null}

        {groups.map(([date, list]) => (
          <div key={date} style={{ marginBottom: 14 }}>
            <div
              className="routine__date"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
            >
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
                    <th style={{ width: 110 }}>Status</th>
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
                              </span>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span className="foundations__badge">{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
