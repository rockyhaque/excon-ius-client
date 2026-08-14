import "@/styles/teacher.css";
import "@/styles/overview.css";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useGetPublishedAllocationsQuery } from "@/redux/features/allocations/allocations.api";
import type { PublishedAllocationRow } from "@/types/teacher";
import { useSkipTeacherApi } from "@/hooks/useTeacherProfile";
import { ChartCard, DonutChart, VIZ } from "@/components/overview/charts";
import { countBy, hoursBetween, isUpcoming, num } from "@/utils/stats";
import { buildDutySlipsHtml, printDocument } from "@/utils/exports";

const CYCLE = [VIZ.blue, VIZ.orange, VIZ.good, VIZ.warning, VIZ.critical, VIZ.neutral];

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

function fmtTime(v: unknown): string {
  const s = String(v ?? "");
  return s ? s.slice(0, 5) : "";
}

function classLabel(row: PublishedAllocationRow): string {
  const parts = [row.dept, row.batch, row.section].filter((p) => p != null && String(p) !== "");
  return parts.length ? parts.map(String).join(" / ") : "—";
}

export function TeacherDutiesPanel({ teacherId }: { teacherId: string | null }) {
  const skipApi = useSkipTeacherApi();
  const { data: all = [], isLoading, error } = useGetPublishedAllocationsQuery(undefined, { skip: skipApi });
  const [view, setView] = useState<"upcoming" | "past">("upcoming");

  const mine = useMemo(
    () => (all as PublishedAllocationRow[]).filter((a) => teacherId && a.teacher_id === teacherId),
    [all, teacherId],
  );

  const rows = useMemo(
    () => mine.filter((a) => (view === "upcoming" ? isUpcoming(a.exam_date) : !isUpcoming(a.exam_date)))
      .sort((a, b) => String(a.exam_date).localeCompare(String(b.exam_date))),
    [mine, view],
  );

  const strip = useMemo(() => {
    const hours = mine.reduce((s, d) => s + hoursBetween(d.start_time, d.end_time), 0);
    const seats = mine.reduce((s, d) => s + num(d.expected_students), 0);
    return { duties: mine.length, hours, seats };
  }, [mine]);

  const deptDonut = useMemo(
    () => countBy(mine, (d) => String(d.dept ?? ""), 6).map((r, i) => ({ ...r, color: CYCLE[i % CYCLE.length] })),
    [mine],
  );

  const onDutySlip = () => {
    if (mine.length === 0) {
      toast.info("You have no published duties to export yet.");
      return;
    }
    if (!printDocument("My Duty Slip", buildDutySlipsHtml(mine)))
      toast.error("Pop-up blocked — allow pop-ups to download your duty slip.");
  };

  return (
    <div className="foundations">
      <div className="card foundations__card">
        <div className="foundations__page-head">
          <div>
            <h2>My allocation</h2>
            <p className="foundations__lead">Published invigilation duties assigned to you.</p>
          </div>
          <button
            type="button"
            className="foundations__btn foundations__btn--ghost"
            onClick={onDutySlip}
            disabled={mine.length === 0}
          >
            Download duty slip (PDF)
          </button>
        </div>

      {!teacherId ? (
        <p className="foundations__muted">{skipApi ? "Sign in to see your duties." : "Loading your profile…"}</p>
      ) : isLoading ? (
        <p className="foundations__muted">Loading…</p>
      ) : error ? (
        <p className="foundations__error">Could not load allocations.</p>
      ) : (
        <>
          <div className="ov-kpis" style={{ marginBottom: 14 }}>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Total duties</div>
              <div className="ov-kpi__value">{strip.duties}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Invigilation hours</div>
              <div className="ov-kpi__value">{strip.hours ? strip.hours.toFixed(1) : 0}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Seats supervised</div>
              <div className="ov-kpi__value">{strip.seats}</div>
            </div>
          </div>

          {mine.length > 0 ? (
            <div style={{ marginBottom: 14 }}>
              <ChartCard title="Duties by department" subtitle="All your published duties">
                <DonutChart centerLabel="duties" data={deptDonut} />
              </ChartCard>
            </div>
          ) : null}

          <div className="teacher-toggle" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="foundations__btn"
              style={view === "upcoming" ? undefined : { opacity: 0.6 }}
              onClick={() => setView("upcoming")}
            >
              Upcoming
            </button>
            <button
              type="button"
              className="foundations__btn"
              style={view === "past" ? undefined : { opacity: 0.6 }}
              onClick={() => setView("past")}
            >
              Past
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="foundations__empty">
              {view === "upcoming" ? "No upcoming duties assigned to you." : "No past duties."}
            </div>
          ) : (
            <div className="foundations__table-wrap">
              <table className="foundations__table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Exam date</th>
                    <th>Time</th>
                    <th>Class</th>
                    <th>Room</th>
                    <th>Students</th>
                    <th>Utilization</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const start = fmtTime(row.start_time);
                    const end = fmtTime(row.end_time);
                    const cap = num(row.room_capacity);
                    const students = num(row.expected_students);
                    const util = cap > 0 ? Math.round((students / cap) * 100) : null;
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.course_name}</strong>
                          {row.course_code ? (
                            <span className="foundations__muted" style={{ margin: 0 }}> {row.course_code}</span>
                          ) : null}
                        </td>
                        <td>{fmtDate(row.exam_date)}</td>
                        <td>{start ? `${start}${end ? `–${end}` : ""}` : "—"}</td>
                        <td>{classLabel(row)}</td>
                        <td>
                          {row.room_name}
                          {cap > 0 ? <span className="foundations__muted" style={{ margin: 0 }}> (cap {cap})</span> : null}
                        </td>
                        <td>{students || "—"}</td>
                        <td>{util != null ? `${util}%` : "—"}</td>
                        <td>
                          <span className="foundations__badge">{row.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
