import { IconEdit } from "@/components/ui/Icons";
import { fmtDate, fmtTime } from "@/components/allocations/allocations.helpers";
import type { AllocationRow } from "@/components/allocations/allocations.types";

export function AllocationTable({
  rows,
  isLoading,
  isError,
  onEdit,
}: {
  rows: AllocationRow[];
  isLoading: boolean;
  isError: boolean;
  onEdit?: (r: AllocationRow) => void;
}) {
  const editable = Boolean(onEdit);
  const colCount = editable ? 8 : 7;

  return (
    <>
      {isLoading ? <p className="foundations__muted">Loading…</p> : null}
      {isError ? <p className="foundations__error">Could not load allocations.</p> : null}

      <div className="foundations__table-wrap">
        <table className="foundations__table">
          <thead>
            <tr>
              <th>Exam date</th>
              <th>Time</th>
              <th>Course</th>
              <th>Dept / Batch / Sec</th>
              <th>Room</th>
              <th>Teacher</th>
              <th>Status</th>
              {editable ? <th style={{ width: 90 }}>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="foundations__empty">
                  {isLoading
                    ? "Loading…"
                    : editable
                      ? "No draft routine yet. Click “Generate routine” to build one."
                      : "Nothing published yet."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.exam_date)}</td>
                  <td>
                    {fmtTime(r.start_time)} - {fmtTime(r.end_time)}
                  </td>
                  <td>
                    <strong>{r.course_code || "—"}</strong>
                    <div className="foundations__muted" style={{ margin: 0 }}>
                      {r.course_name}
                    </div>
                  </td>
                  <td>{[r.dept, r.batch, r.section].filter(Boolean).join(" / ") || "—"}</td>
                  <td>
                    <strong>{r.room_name || "—"}</strong>
                    {r.room_building || r.room_capacity != null ? (
                      <div className="foundations__muted" style={{ margin: 0 }}>
                        {[r.room_building, r.room_capacity != null ? `cap ${r.room_capacity}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {r.teacher_name || "—"}
                    {r.employee_id ? (
                      <div className="foundations__muted" style={{ margin: 0 }}>
                        {r.employee_id}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span className="foundations__badge">{r.status || "—"}</span>
                  </td>
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className="foundations__icon-btn"
                        onClick={() => onEdit?.(r)}
                        aria-label="Reassign allocation"
                      >
                        <IconEdit />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
