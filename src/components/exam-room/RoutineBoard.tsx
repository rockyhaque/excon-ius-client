import { Fragment, useMemo, useState } from "react";
import { fmtBoardDay, sessionKey, type ExamRow } from "@/components/exam-room/examRoutine.types";

/** Drag-and-drop rescheduling board: dates (rows) × sessions (columns). Drag an exam card into
 *  another cell to move it to that date + session. Reschedules flow through updateExam, which
 *  re-notifies the invigilators. */
export function RoutineBoard({
  rows,
  onMove,
  moving,
}: {
  rows: ExamRow[];
  onMove: (examId: string, date: string, st: string, et: string) => void;
  moving: boolean;
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const sessions = useMemo(() => [...new Set(rows.map(sessionKey))].sort(), [rows]);
  const dates = useMemo(() => [...new Set(rows.map((r) => r.exam_date))].sort(), [rows]);

  const sessionLabel = (sk: string) => {
    const [st, et] = sk.split("|");
    return `${st < "12:00" ? "Morning" : "Afternoon"} · ${st}–${et}`;
  };

  return (
    <div style={{ overflowX: "auto", paddingBottom: 6 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `128px repeat(${sessions.length}, minmax(230px, 1fr))`,
          gap: 8,
          minWidth: 128 + sessions.length * 240,
        }}
      >
        <div />
        {sessions.map((sk) => (
          <div key={sk} style={{ fontSize: 12, fontWeight: 700, color: "#5c0931", padding: "2px 6px" }}>
            {sessionLabel(sk)}
          </div>
        ))}

        {dates.map((d) => (
          <Fragment key={d}>
            <div style={{ fontSize: 13, fontWeight: 600, alignSelf: "start", padding: "10px 4px 0" }}>
              {fmtBoardDay(d)}
            </div>
            {sessions.map((sk) => {
              const key = `${d}__${sk}`;
              const [st, et] = sk.split("|");
              const cellExams = rows.filter((r) => r.exam_date === d && sessionKey(r) === sk);
              const active = dropTarget === key;
              return (
                <div
                  key={key}
                  data-cell={key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!active) setDropTarget(key);
                  }}
                  onDragLeave={() => setDropTarget((t) => (t === key ? null : t))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropTarget(null);
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) onMove(id, d, st, et);
                  }}
                  style={{
                    minHeight: 60,
                    border: `1.5px ${active ? "solid" : "dashed"} ${active ? "#5c0931" : "#e5e7eb"}`,
                    borderRadius: 10,
                    background: active ? "#faf0f5" : "#fff",
                    padding: 6,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    opacity: moving ? 0.7 : 1,
                  }}
                >
                  {cellExams.map((r) => (
                    <div
                      key={r.id}
                      data-exam-id={r.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                      title="Drag to reschedule"
                      style={{
                        border: "1px solid #e7cdd9",
                        background: "#fbf5f8",
                        borderRadius: 8,
                        padding: "6px 8px",
                        cursor: "grab",
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#5c0931" }}>{r.course_code}</div>
                      <div style={{ color: "#374151" }}>{r.course_name}</div>
                      <div style={{ color: "#6b7280", marginTop: 2 }}>
                        B{r.batch}
                        {r.section ? `-${r.section}` : ""} · {r.room_name || "no room"}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <p className="foundations__muted" style={{ margin: "10px 2px 0", fontSize: 12.5 }}>
        Drag an exam card into another session to reschedule it. Assigned invigilators are re-notified automatically.
      </p>
    </div>
  );
}
