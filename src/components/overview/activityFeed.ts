import { VIZ } from "@/components/overview/charts";

export type ActivityFeedItem = {
  id: string;
  title: string;
  detail: string;
  actor: string;
  time: string;
  timestamp: number;
  color: string;
};

type Row = Record<string, unknown>;

const ACTION_META: Record<string, { title: string; color: string }> = {
  EXAM_ROUTINE_GENERATE: { title: "Exam routine generated", color: VIZ.good },
  EXAM_ROUTINE_DELETE: { title: "Exam routine deleted", color: VIZ.critical },
  ALLOCATION_GENERATE: { title: "Invigilation routine generated", color: VIZ.blue },
  ALLOCATION_PUBLISH: { title: "Invigilation routine published", color: VIZ.good },
  ALLOCATION_CLEAR_DRAFT: { title: "Draft routine cleared", color: VIZ.warning },
  MANUAL_ALLOCATION_CREATE: { title: "Manual duty assigned", color: VIZ.blue },
  MANUAL_ALLOCATION_OVERRIDE: { title: "Duty reassigned", color: VIZ.warning },
  EMERGENCY_REALLOCATION: { title: "Emergency reallocation", color: VIZ.critical },
  LEAVE_REQUEST: { title: "Leave requested", color: VIZ.warning },
  LEAVE_APPROVE: { title: "Leave approved", color: VIZ.good },
  LEAVE_REJECT: { title: "Leave rejected", color: VIZ.critical },
};

const fmtTime = (v: unknown): string => {
  const s = String(v ?? "");
  return s.length >= 16 ? s.replace("T", " ").slice(0, 16) : s.slice(0, 10) || "—";
};

const fmtDate = (v: unknown): string => {
  const s = String(v ?? "");
  return s ? s.slice(0, 10) : "";
};

const dateRange = (start: unknown, end: unknown): string => {
  const a = fmtDate(start);
  const b = fmtDate(end);
  if (!a && !b) return "";
  return a === b || !b ? a : `${a} → ${b}`;
};

const parseDetails = (raw: unknown): Row | null => {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Row) : null;
    } catch {
      return null;
    }
  }
  return typeof raw === "object" ? (raw as Row) : null;
};

const humanizeAction = (action: string): string =>
  action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const isUuid = (v: unknown): boolean =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(v);

function formatLogDetail(
  action: string,
  d: Row | null,
  teacherMap: Map<string, string>,
  roomMap: Map<string, string>,
): string {
  if (!d) return "—";
  const teacherOf = (id: unknown) => (id ? teacherMap.get(String(id)) ?? "Teacher" : "");
  const roomOf = (id: unknown) => {
    if (!id) return "";
    const name = roomMap.get(String(id));
    return name ? (/^room\b/i.test(name) ? name : `Room ${name}`) : "Room";
  };

  switch (action) {
    case "EXAM_ROUTINE_GENERATE":
      return (
        [
          d.exam_type ? String(d.exam_type) : "",
          d.created != null ? `${d.created} exams` : "",
          d.exam_dates != null ? `${d.exam_dates} days` : "",
          d.rooms_assigned != null ? `${d.rooms_assigned} rooms` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "—"
      );

    case "EXAM_ROUTINE_DELETE":
      return (
        [
          d.exam_type ? String(d.exam_type) : "",
          d.deleted != null ? `${d.deleted} exams removed` : "",
          Number(d.published_duties_removed) > 0 ? `${d.published_duties_removed} published duties removed` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "—"
      );

    case "ALLOCATION_GENERATE":
      return (
        [
          d.assigned != null ? `${d.assigned} duties assigned` : "",
          d.exams_total != null ? `${d.exams_total} exams` : "",
          Number(d.exams_partial) > 0 ? `${d.exams_partial} partial` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "—"
      );

    case "ALLOCATION_PUBLISH":
      return d.count != null ? `${d.count} duties published & notified` : "Teachers notified";

    case "ALLOCATION_CLEAR_DRAFT":
      return d.cleared != null ? `${d.cleared} draft duties cleared` : "Draft duties cleared";

    case "MANUAL_ALLOCATION_CREATE":
      return [teacherOf(d.teacher_id), roomOf(d.room_id)].filter(Boolean).join(" · ") || "—";

    case "MANUAL_ALLOCATION_OVERRIDE": {
      const parts: string[] = [];
      if (d.old_teacher || d.new_teacher) {
        const oldT = teacherOf(d.old_teacher) || "—";
        const newT = teacherOf(d.new_teacher) || "—";
        if (d.old_teacher !== d.new_teacher) parts.push(`${oldT} → ${newT}`);
      }
      if (d.old_room || d.new_room) {
        const oldR = roomOf(d.old_room) || "—";
        const newR = roomOf(d.new_room) || "—";
        if (d.old_room !== d.new_room) parts.push(`${oldR} → ${newR}`);
      }
      return parts.join(" · ") || teacherOf(d.new_teacher) || "Duty updated";
    }

    case "EMERGENCY_REALLOCATION":
      return d.absent_teacher_id ? `Absent: ${teacherOf(d.absent_teacher_id)}` : "Duties reassigned";

    case "LEAVE_REQUEST":
    case "LEAVE_APPROVE":
    case "LEAVE_REJECT":
      return (
        [
          teacherOf(d.teacher_id),
          dateRange(d.start_date, d.end_date),
          d.reason ? String(d.reason) : "",
          Number(d.reassigned) > 0 ? `${d.reassigned} duties reassigned` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "—"
      );

    default: {
      const pairs = Object.entries(d)
        .filter(([, v]) => v != null && v !== "" && !isUuid(v))
        .slice(0, 4)
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`);
      return pairs.join(" · ") || "—";
    }
  }
}

export function buildRecentActivity(
  logs: Row[],
  leaves: Row[],
  teacherMap: Map<string, string>,
  roomMap: Map<string, string>,
  limit = 8,
): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [];
  const loggedLeaves = new Set<string>();

  for (let i = 0; i < logs.length; i++) {
    const l = logs[i];
    const action = String(l.action ?? "").toUpperCase();
    if (!action || action === "ASSISTANT_QUERY") continue;

    const details = parseDetails(l.details);
    if (action.startsWith("LEAVE_") && details) {
      const key = `${String(details.teacher_id ?? "")}|${fmtDate(details.start_date)}|${fmtDate(details.end_date)}|${action}`;
      loggedLeaves.add(key);
    }

    const meta = ACTION_META[action] ?? { title: humanizeAction(action), color: VIZ.blue };
    const tsRaw = l.created_at ?? l.updated_at;
    const ts = tsRaw ? Date.parse(String(tsRaw)) : 0;

    items.push({
      id: `log-${String(l.id ?? i)}`,
      title: meta.title,
      detail: formatLogDetail(action, details, teacherMap, roomMap),
      actor: String(l.user_name ?? l.admin_name ?? "System"),
      time: fmtTime(tsRaw),
      timestamp: Number.isFinite(ts) ? ts : 0,
      color: meta.color,
    });
  }

  for (let i = 0; i < leaves.length; i++) {
    const lv = leaves[i];
    const status = String(lv.status ?? "PENDING").toUpperCase();
    const action =
      status === "APPROVED" ? "LEAVE_APPROVE" : status === "REJECTED" ? "LEAVE_REJECT" : "LEAVE_REQUEST";
    const key = `${String(lv.teacher_id ?? "")}|${fmtDate(lv.start_date)}|${fmtDate(lv.end_date)}|${action}`;
    if (loggedLeaves.has(key)) continue;

    const meta = ACTION_META[action];
    const tsRaw = status === "PENDING" ? (lv.created_at ?? lv.updated_at) : (lv.updated_at ?? lv.created_at);
    const ts = tsRaw ? Date.parse(String(tsRaw)) : 0;
    const teacherName = String(lv.teacher_name ?? teacherMap.get(String(lv.teacher_id ?? "")) ?? "Teacher");

    items.push({
      id: `leave-${String(lv.id ?? i)}`,
      title: meta.title,
      detail: [teacherName, dateRange(lv.start_date, lv.end_date), lv.reason ? String(lv.reason) : ""]
        .filter(Boolean)
        .join(" · "),
      actor: status === "PENDING" ? teacherName : "Admin",
      time: fmtTime(tsRaw),
      timestamp: Number.isFinite(ts) ? ts : 0,
      color: meta.color,
    });
  }

  return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}
