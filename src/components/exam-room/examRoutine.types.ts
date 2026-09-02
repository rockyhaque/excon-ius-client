export type ExamType = "MIDTERM" | "FINAL";

export type ExamRow = {
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
  room_id: string;
  room_name: string;
  room_building: string;
  room_capacity: number | null;
};

export type Semester = { id: string; name: string; season: string; year: string };

export type DeptOption = { id: string; name: string; code: string };

export type RoomOption = { id: string; name: string; capacity: number | null };

export const s = (v: unknown) => (v == null ? "" : String(v));

export const arr = (x: unknown): Record<string, unknown>[] => {
  if (Array.isArray(x)) return x as Record<string, unknown>[];
  const d = (x as { data?: unknown } | undefined)?.data;
  return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
};

export const fmtBoardDay = (iso: string) => {
  const dt = new Date(iso + "T00:00:00Z");
  return isNaN(dt.getTime())
    ? iso
    : dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
};

export const sessionKey = (r: ExamRow) => `${r.start_time.slice(0, 5)}|${r.end_time.slice(0, 5)}`;
