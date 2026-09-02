export type AiSummary = {
  total_assigned: number;
  skipped_no_room: number;
  skipped_no_teacher: number;
  exams_fully_staffed: number;
  exams_partial: number;
  students_per_invigilator: number;
};

export type AllocationTab = "draft" | "published";

export type RoomOption = { id: string; name: string; capacity: number | null; is_defect: boolean };

export function fmtDate(v: string): string {
  return v ? v.slice(0, 10) : "—";
}

export function fmtTime(v: string): string {
  return v ? v.slice(0, 5) : "—";
}

export function toCount(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function SummaryPill({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        color: "#fff",
        background: color,
      }}
    >
      {value} <span style={{ fontWeight: 400, opacity: 0.92 }}>{label}</span>
    </span>
  );
}
