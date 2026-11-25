import "@/styles/teacher.css";
import { LoadingSpinner } from "@/components/ui/Loading";
import { isUpcoming } from "@/utils/stats";
import type { PublishedAllocationRow } from "@/types/teacher";

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

function classLabel(e: PublishedAllocationRow): string {
  const parts = [e.dept, e.batch, e.section].filter((p) => p != null && String(p) !== "");
  return parts.length ? parts.map(String).join(" / ") : "—";
}

export function TeacherExamsSnippet({
  duties,
  isLoading,
  error,
  skipApi,
  title = "Upcoming exams",
  lead = "Only the exams where you have an invigilation duty.",
}: {
  duties: PublishedAllocationRow[];
  isLoading: boolean;
  error: unknown;
  skipApi: boolean;
  title?: string;
  lead?: string;
}) {
  const upcoming = duties
    .filter((d) => isUpcoming(d.exam_date))
    .slice()
    .sort((a, b) => {
      const byDate = String(a.exam_date).localeCompare(String(b.exam_date));
      if (byDate !== 0) return byDate;
      return String(a.start_time ?? "").localeCompare(String(b.start_time ?? ""));
    });

  return (
    <div className="foundations">
      <div className="card foundations__card">
        <div className="foundations__page-head">
          <div>
            <h2>{title}</h2>
            <p className="foundations__lead">{lead}</p>
          </div>
        </div>
      {skipApi ? (
        <p className="foundations__muted">Sign in to load your duties.</p>
      ) : isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <p className="foundations__error">Could not load your duties.</p>
      ) : upcoming.length === 0 ? (
        <div className="foundations__empty">You have no upcoming invigilation duties.</div>
      ) : (
        <div className="teacher-table-wrap">
          <table className="teacher-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Course</th>
                <th>Dept / Batch / Section</th>
                <th>Room</th>
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
                    <td>{e.room_name || "—"}</td>
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
