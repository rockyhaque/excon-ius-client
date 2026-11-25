import { LoadingSpinner } from "@/components/ui/Loading";
import { Modal } from "@/components/ui/Modal";
import { fmtDate, fmtTime } from "@/components/allocations/allocations.helpers";
import type { AllocationRow } from "@/components/allocations/allocations.types";
import type { RoomOption } from "@/components/allocations/allocations.helpers";

type TeacherSearchResult = { id: string; name: string; employee_id?: string | null };

export function ReassignAllocationModal({
  editing,
  saving,
  teacherId,
  teacherLabel,
  roomId,
  searchTerm,
  formError,
  rooms,
  teacherResults,
  teacherSearchFetching,
  onClose,
  onSubmit,
  onSearchTermChange,
  onSearchTeachers,
  onTeacherIdChange,
  onTeacherLabelChange,
  onRoomIdChange,
}: {
  editing: AllocationRow | null;
  saving: boolean;
  teacherId: string;
  teacherLabel: string;
  roomId: string;
  searchTerm: string;
  formError: string | null;
  rooms: RoomOption[];
  teacherResults: TeacherSearchResult[];
  teacherSearchFetching: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onSearchTermChange: (value: string) => void;
  onSearchTeachers: () => void;
  onTeacherIdChange: (value: string) => void;
  onTeacherLabelChange: (value: string) => void;
  onRoomIdChange: (value: string) => void;
}) {
  return (
    <Modal
      open={Boolean(editing)}
      title="Reassign allocation"
      onClose={onClose}
      footer={
        <div className="foundations__modal-actions">
          <button className="foundations__btn foundations__btn--ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="foundations__btn" type="button" disabled={saving} onClick={onSubmit}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      }
    >
      {editing ? (
        <div className="foundations__form">
          <div className="foundations__muted" style={{ marginTop: 0 }}>
            {editing.course_code} · {fmtDate(editing.exam_date)} · {fmtTime(editing.start_time)}-{fmtTime(editing.end_time)}
          </div>

          <label className="foundations__field">
            <span>Teacher</span>
            <div className="foundations__actions" style={{ width: "100%" }}>
              <input
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSearchTeachers();
                  }
                }}
                placeholder="Search by name, email or employee ID"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="foundations__btn foundations__btn--ghost"
                onClick={onSearchTeachers}
                disabled={teacherSearchFetching || !searchTerm.trim()}
              >
                {teacherSearchFetching ? <LoadingSpinner compact size={16} /> : "Search"}
              </button>
            </div>
          </label>

          {teacherResults.length > 0 ? (
            <label className="foundations__field">
              <span>Search results</span>
              <select
                value={teacherId}
                onChange={(e) => {
                  const id = e.target.value;
                  onTeacherIdChange(id);
                  const found = teacherResults.find((t) => t.id === id);
                  if (found) onTeacherLabelChange(found.name);
                }}
              >
                <option value="">Select a teacher…</option>
                {teacherResults.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.employee_id ? ` (${t.employee_id})` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="foundations__muted" style={{ marginTop: 0 }}>
            Selected teacher: <strong>{teacherLabel || "—"}</strong>
          </div>

          <label className="foundations__field">
            <span>Room</span>
            <select value={roomId} onChange={(e) => onRoomIdChange(e.target.value)}>
              <option value="">Select a room…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id} disabled={r.is_defect}>
                  {r.name}
                  {r.capacity != null ? ` · cap ${r.capacity}` : ""}
                  {r.is_defect ? " (defect)" : ""}
                </option>
              ))}
            </select>
          </label>

          {formError ? <div className="foundations__error">{formError}</div> : null}
        </div>
      ) : null}
    </Modal>
  );
}
