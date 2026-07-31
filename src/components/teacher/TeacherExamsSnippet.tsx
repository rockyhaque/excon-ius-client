import "@/styles/teacher.css";
import { useGetExamsQuery } from "@/redux/features/exam-room/examRoom.api";
import { useSkipTeacherApi } from "@/hooks/useTeacherProfile";
import { asList } from "@/utils/stats";
import type { TeacherExamRow } from "@/types/teacher";

function fmtDate(v: unknown): string {
  const s = String(v ?? "").slice(0, 10);
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(v: unknown): string {
  const s = String(v ?? "");
  return s ? s.slice(0, 5) : "";
}

function classLabel(e: TeacherExamRow): string {
  const parts = [e.dept, e.batch, e.section].filter((p) => p != null && String(p) !== "");
  return parts.length ? parts.map(String).join(" / ") : "—";
}

export function TeacherExamsSnippet() {
  const skipApi = useSkipTeacherApi();
  const { data: exams, isLoading, error } = useGetExamsQuery({ limit: 100 }, { skip: skipApi });

  const upcoming = asList<TeacherExamRow>(exams)
    .filter((e) => e.exam_date)
    .slice(0, 8);

  return (
    <div className="foundations">
      <div className="card foundations__card">
        <div className="foundations__page-head">
          <div>
            <h2>Upcoming exams</h2>
            <p className="foundations__lead">Reference schedule for upcoming exams. Your assigned duties appear under My allocation.</p>
          </div>
        </div>
      {skipApi ? (
        <p className="foundations__muted">Sign in to load the exam schedule.</p>
      ) : isLoading ? (
        <p className="foundations__muted">Loading…</p>
      ) : error ? (
        <p className="foundations__error">Could not load exams.</p>
      ) : upcoming.length === 0 ? (
        <div className="foundations__empty">No exams in the list.</div>
      ) : (
        <div className="teacher-table-wrap">
          <table className="teacher-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Course</th>
                <th>Dept / Batch / Section</th>
                <th>Semester</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((e) => {
                const start = fmtTime(e.start_time);
                const end = fmtTime(e.end_time);
                return (
                  <tr key={String(e.id)}>
                    <td>{fmtDate(e.exam_date)}</td>
                    <td>{start ? `${start}${end ? `–${end}` : ""}` : "—"}</td>
                    <td>
                      <strong>{String(e.course_name ?? e.course_code ?? "Exam")}</strong>
                      {e.course_code ? <span className="foundations__muted" style={{ margin: 0 }}> {String(e.course_code)}</span> : null}
                    </td>
                    <td>{classLabel(e)}</td>
                    <td>{e.semester_name ? String(e.semester_name) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
