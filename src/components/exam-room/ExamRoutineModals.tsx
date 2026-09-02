import { Modal } from "@/components/ui/Modal";
import { BatchMultiSelect } from "@/components/exam-room/BatchMultiSelect";
import type { Batch } from "@/types/foundations";
import type { DeptOption, ExamRow, ExamType, RoomOption, Semester } from "@/components/exam-room/examRoutine.types";

type TimeSlot = { start: string; end: string };

export function GenerateRoutineModal({
  open,
  generating,
  semesters,
  genDepartments,
  runningBatches,
  genSem,
  examType,
  genDept,
  selectedBatchIds,
  startDate,
  endDate,
  slots,
  studentsPerSection,
  skipWeekends,
  replace,
  genError,
  onClose,
  onSubmit,
  onGenSemChange,
  onExamTypeChange,
  onGenDeptChange,
  onToggleBatch,
  onSetManyBatches,
  onStartDateChange,
  onEndDateChange,
  onUpdateSlot,
  onAddSlot,
  onRemoveSlot,
  onStudentsPerSectionChange,
  onSkipWeekendsChange,
  onReplaceChange,
}: {
  open: boolean;
  generating: boolean;
  semesters: Semester[];
  genDepartments: DeptOption[];
  runningBatches: Batch[];
  genSem: string;
  examType: ExamType;
  genDept: string;
  selectedBatchIds: Set<string>;
  startDate: string;
  endDate: string;
  slots: TimeSlot[];
  studentsPerSection: number;
  skipWeekends: boolean;
  replace: boolean;
  genError: string | null;
  onClose: () => void;
  onSubmit: () => void;
  onGenSemChange: (value: string) => void;
  onExamTypeChange: (value: ExamType) => void;
  onGenDeptChange: (value: string) => void;
  onToggleBatch: (id: string) => void;
  onSetManyBatches: (ids: string[], on: boolean) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onUpdateSlot: (index: number, field: "start" | "end", value: string) => void;
  onAddSlot: () => void;
  onRemoveSlot: (index: number) => void;
  onStudentsPerSectionChange: (value: number) => void;
  onSkipWeekendsChange: (value: boolean) => void;
  onReplaceChange: (value: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      title="Generate exam routine"
      width={600}
      onClose={onClose}
      footer={
        <div className="foundations__modal-actions">
          <button className="foundations__btn foundations__btn--ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="foundations__btn" type="button" disabled={generating} onClick={onSubmit}>
            {generating ? "Generating…" : "Generate"}
          </button>
        </div>
      }
    >
      <div className="foundations__form">
        <label className="foundations__field">
          <span>Semester</span>
          <select value={genSem} onChange={(e) => onGenSemChange(e.target.value)}>
            {semesters.length === 0 ? <option value="">No semesters yet</option> : null}
            {semesters.map((sm) => (
              <option key={sm.id} value={sm.id}>
                {sm.name} ({sm.season})
              </option>
            ))}
          </select>
        </label>
        {semesters.length === 0 ? (
          <p className="foundations__muted" style={{ margin: "-4px 0 0" }}>
            No semesters yet — create one in <strong>Foundations → Semesters</strong>, then it will appear here.
          </p>
        ) : null}

        <label className="foundations__field">
          <span>Exam type</span>
          <select value={examType} onChange={(e) => onExamTypeChange(e.target.value as ExamType)}>
            <option value="MIDTERM">Midterm</option>
            <option value="FINAL">Final</option>
          </select>
        </label>

        <label className="foundations__field">
          <span>Department</span>
          <select value={genDept} onChange={(e) => onGenDeptChange(e.target.value)}>
            <option value="">All departments</option>
            {genDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <div className="foundations__field">
          <span>Batches</span>
          {runningBatches.length === 0 ? (
            <p className="foundations__muted" style={{ margin: 0 }}>
              No running batches{genDept ? " in this department" : ""} — completed batches don't sit exams. Add or resume
              batches in <strong>Foundations → Batches</strong>.
            </p>
          ) : (
            <>
              <BatchMultiSelect
                batches={runningBatches}
                departments={genDepartments}
                groupByDept={!genDept && genDepartments.length > 0}
                selected={selectedBatchIds}
                onToggle={onToggleBatch}
                onSetMany={onSetManyBatches}
              />
              <span className="foundations__muted" style={{ margin: "6px 0 0", fontSize: 12.5 }}>
                Only running batches are shown — completed batches don't sit exams.
              </span>
            </>
          )}
        </div>

        <label className="foundations__field">
          <span>Start date</span>
          <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
        </label>
        <label className="foundations__field">
          <span>End date</span>
          <input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
        </label>
        <div className="foundations__field">
          <span>Daily time slots</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {slots.map((sl, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="time" value={sl.start} onChange={(e) => onUpdateSlot(i, "start", e.target.value)} />
                <span className="foundations__muted" style={{ margin: 0 }}>
                  to
                </span>
                <input type="time" value={sl.end} onChange={(e) => onUpdateSlot(i, "end", e.target.value)} />
                <button
                  type="button"
                  className="foundations__btn foundations__btn--ghost"
                  style={{ padding: "6px 10px" }}
                  onClick={() => onRemoveSlot(i)}
                  disabled={slots.length === 1}
                  aria-label={`Remove slot ${i + 1}`}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="foundations__btn foundations__btn--ghost"
              style={{ alignSelf: "flex-start", padding: "6px 10px" }}
              onClick={onAddSlot}
            >
              + Add slot
            </button>
          </div>
        </div>
        <p className="foundations__muted" style={{ margin: 0 }}>
          Add a second slot (e.g. an afternoon session) to schedule more exams per day. Slots must not overlap.
        </p>
        <label className="foundations__field">
          <span>Students per section (for room seating)</span>
          <input
            type="number"
            min={1}
            value={studentsPerSection}
            onChange={(e) => onStudentsPerSectionChange(Number(e.target.value))}
          />
        </label>

        <p className="foundations__muted" style={{ margin: 0 }}>
          Rooms are seated by capacity automatically. Teacher invigilation stays in Allocations — not mixed here.
        </p>

        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={skipWeekends} onChange={(e) => onSkipWeekendsChange(e.target.checked)} />
          <span className="foundations__muted" style={{ margin: 0 }}>
            Skip weekends (Friday &amp; Saturday)
          </span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={replace} onChange={(e) => onReplaceChange(e.target.checked)} />
          <span className="foundations__muted" style={{ margin: 0 }}>
            Replace existing {examType} exams for the selected {selectedBatchIds.size === 1 ? "batch" : "batches"}
          </span>
        </label>

        {genError ? <div className="foundations__error">{genError}</div> : null}
      </div>
    </Modal>
  );
}

export function EditExamModal({
  editing,
  saving,
  eDate,
  eStart,
  eEnd,
  eStatus,
  eStudents,
  eRoomId,
  editError,
  roomOptions,
  onClose,
  onSubmit,
  onEDateChange,
  onEStartChange,
  onEEndChange,
  onEStatusChange,
  onEStudentsChange,
  onERoomIdChange,
}: {
  editing: ExamRow | null;
  saving: boolean;
  eDate: string;
  eStart: string;
  eEnd: string;
  eStatus: string;
  eStudents: number | "";
  eRoomId: string;
  editError: string | null;
  roomOptions: RoomOption[];
  onClose: () => void;
  onSubmit: () => void;
  onEDateChange: (value: string) => void;
  onEStartChange: (value: string) => void;
  onEEndChange: (value: string) => void;
  onEStatusChange: (value: string) => void;
  onEStudentsChange: (value: number | "") => void;
  onERoomIdChange: (value: string) => void;
}) {
  return (
    <Modal
      open={Boolean(editing)}
      title="Edit exam"
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
            {editing.course_code} · {editing.dept} · B{editing.batch}
            {editing.section ? `-${editing.section}` : ""} · {editing.exam_type || "—"}
            {editing.room_name ? ` · ${editing.room_name}` : ""}
          </div>
          <label className="foundations__field">
            <span>Exam date</span>
            <input type="date" value={eDate} onChange={(e) => onEDateChange(e.target.value)} />
          </label>
          <label className="foundations__field">
            <span>Start time</span>
            <input type="time" value={eStart} onChange={(e) => onEStartChange(e.target.value)} />
          </label>
          <label className="foundations__field">
            <span>End time</span>
            <input type="time" value={eEnd} onChange={(e) => onEEndChange(e.target.value)} />
          </label>
          <label className="foundations__field">
            <span>Status</span>
            <select value={eStatus} onChange={(e) => onEStatusChange(e.target.value)}>
              <option value="SCHEDULED">Scheduled</option>
              <option value="RESCHEDULED">Rescheduled</option>
              <option value="PENDING">Pending</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <label className="foundations__field">
            <span>Expected students (actual headcount for seating)</span>
            <input
              type="number"
              min={0}
              value={eStudents}
              onChange={(e) => onEStudentsChange(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 38"
            />
          </label>
          <label className="foundations__field">
            <span>Seating room</span>
            <select value={eRoomId} onChange={(e) => onERoomIdChange(e.target.value)}>
              <option value="">— No room —</option>
              {roomOptions.map((r) => {
                const over = eStudents !== "" && r.capacity != null && Number(eStudents) > r.capacity;
                return (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.capacity != null ? ` (cap ${r.capacity})` : ""}
                    {over ? " — over capacity" : ""}
                  </option>
                );
              })}
            </select>
          </label>
          {editError ? <div className="foundations__error">{editError}</div> : null}
        </div>
      ) : null}
    </Modal>
  );
}
