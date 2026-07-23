/**
 * Row shape returned by GET /allocations/ai-allocation (DRAFT) and
 * GET /allocations/published (PUBLISHED). Joined view of allocation + exam + room + teacher.
 */
export type AllocationRow = {
  id: string;
  status: string;
  exam_id: string;
  teacher_id: string;
  room_id: string;
  course_name: string;
  course_code: string;
  dept: string;
  batch: string;
  section: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  expected_students: number | null;
  room_name: string;
  room_capacity: number | null;
  teacher_name: string;
  employee_id: string | null;
  designation: string | null;
  teacher_email: string | null;
};

function asId(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toRowArray(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) return input as Record<string, unknown>[];
  const data = (input as { data?: unknown })?.data;
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  return [];
}

export function mapAllocations(rows: unknown): AllocationRow[] {
  return toRowArray(rows).map((a) => ({
    id: asId(a.id),
    status: str(a.status),
    exam_id: asId(a.exam_id),
    teacher_id: asId(a.teacher_id),
    room_id: asId(a.room_id),
    course_name: str(a.course_name),
    course_code: str(a.course_code),
    dept: str(a.dept),
    batch: str(a.batch),
    section: str(a.section),
    exam_date: str(a.exam_date),
    start_time: str(a.start_time),
    end_time: str(a.end_time),
    expected_students: numOrNull(a.expected_students),
    room_name: str(a.room_name),
    room_capacity: numOrNull(a.room_capacity),
    teacher_name: str(a.teacher_name),
    employee_id: a.employee_id == null ? null : str(a.employee_id),
    designation: a.designation == null ? null : str(a.designation),
    teacher_email: a.teacher_email == null ? null : str(a.teacher_email),
  }));
}
