import type { Exam, ExamRoomEntity, Room } from "@/types/examRoom";

function asNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// IDs are UUID strings — never coerce them to Number (that yields NaN → 0, colliding keys).
function asId(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v === "true" || v === "1";
  return Boolean(v);
}

function safeStr(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function toRowArray(input: unknown): ExamRoomEntity[] {
  if (Array.isArray(input)) return input as ExamRoomEntity[];
  const data = (input as any)?.data;
  if (Array.isArray(data)) return data as ExamRoomEntity[];
  return [];
}

export function mapRooms(rows: unknown): Room[] {
  return toRowArray(rows).map((r) => ({
    id: asId(r.id),
    name: safeStr(r.name),
    building: safeStr(r.building),
    capacity: asNum(r.capacity),
    is_defect: asBool((r as any).is_defect),
  }));
}

export function mapExams(rows: unknown): Exam[] {
  return toRowArray(rows).map((e) => ({
    id: asId(e.id),
    course_id: asId((e as any).course_id),
    course_name: safeStr((e as any).course_name),
    course_code: safeStr((e as any).course_code),
    dept_id: asId((e as any).dept_id),
    dept: safeStr((e as any).dept),
    batch_id: asId((e as any).batch_id),
    batch: safeStr((e as any).batch),
    section_id: asId((e as any).section_id),
    section: safeStr((e as any).section),
    exam_date: safeStr((e as any).exam_date),
    start_time: safeStr((e as any).start_time),
    end_time: safeStr((e as any).end_time),
    status: safeStr((e as any).status),
    expected_students: (e as any).expected_students == null ? null : asNum((e as any).expected_students),
    semester_name: safeStr((e as any).semester_name),
  }));
}

