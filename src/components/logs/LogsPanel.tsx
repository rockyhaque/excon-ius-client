import { useMemo, useState, type ReactNode } from "react";
import {
  useGetActivityLogsQuery,
  useGetAdminActionLogsQuery,
  useGetAllocationHistoryLogsQuery,
  useGetLeaveApprovalLogsQuery,
  type LogRow,
} from "@/redux/features/logs/logs.api";
import { useGetTeachersQuery } from "@/redux/features/users/users.api";
import { useGetExamsQuery, useGetRoomsQuery } from "@/redux/features/exam-room/examRoom.api";

type Tab = "activity" | "allocation" | "leave" | "admin";

const arr = (x: unknown): Record<string, unknown>[] => {
  if (Array.isArray(x)) return x as Record<string, unknown>[];
  const d = (x as { data?: unknown } | undefined)?.data;
  return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
};

function safeStr(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function fmtDateTime(v: unknown): string {
  const s = safeStr(v);
  if (!s) return "—";
  if (s.length >= 19) return s.replace("T", " ").slice(0, 19);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

function fmtDate(v: unknown): string {
  const s = safeStr(v);
  return s ? s.slice(0, 10) : "—";
}

const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(v);
const shortId = (v: string) => (v.length > 12 ? `${v.slice(0, 8)}…` : v);

/** "absent_teacher_id" → "Absent teacher"; "allocation_id" → "Allocation". */
function humanizeKey(key: string): string {
  return key
    .replace(/_id$/, "")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** "EMERGENCY_REALLOCATION" → "Emergency reallocation". */
function humanizeAction(a: unknown): string {
  const s = safeStr(a);
  if (!s) return "—";
  return s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function statusPill(statusRaw: unknown): ReactNode {
  const s = safeStr(statusRaw).toUpperCase();
  if (!s) return "—";
  const danger = s === "REJECTED" || s === "CANCELLED";
  return <span className={`foundations__badge ${danger ? "foundations__badge--danger" : ""}`}>{s}</span>;
}

type NameMaps = { teacher: Map<string, string>; room: Map<string, string>; exam: Map<string, string> };

/** Turn a UUID (or plain value) into a human name using the entity implied by the key. */
function resolveValue(key: string, value: unknown, maps: NameMaps): string {
  if (!isUuid(value)) return safeStr(value) || "—";
  const k = key.toLowerCase();
  if (k.includes("teacher")) return maps.teacher.get(value) ?? shortId(value);
  if (k.includes("room")) return maps.room.get(value) ?? shortId(value);
  if (k.includes("exam")) return maps.exam.get(value) ?? shortId(value);
  return shortId(value);
}

/** Render a JSONB `details` blob as readable label/value chips (old/new pairs collapse to "before → after"). */
function renderDetails(details: unknown, maps: NameMaps): ReactNode {
  let obj: Record<string, unknown> | null = null;
  if (details == null) return <span className="foundations__muted">—</span>;
  if (typeof details === "string") {
    try {
      obj = JSON.parse(details);
    } catch {
      return details;
    }
  } else if (typeof details === "object") {
    obj = details as Record<string, unknown>;
  }
  if (!obj || typeof obj !== "object") return safeStr(details) || "—";

  const handled = new Set<string>();
  const pairs: { label: string; value: string }[] = [];

  for (const key of Object.keys(obj)) {
    if (handled.has(key)) continue;
    const m = key.match(/^(old|new)_(.+)$/);
    if (m) {
      const suffix = m[2];
      const ok = `old_${suffix}`;
      const nk = `new_${suffix}`;
      if (ok in obj || nk in obj) {
        handled.add(ok);
        handled.add(nk);
        const before = ok in obj ? resolveValue(suffix, obj[ok], maps) : "—";
        const after = nk in obj ? resolveValue(suffix, obj[nk], maps) : "—";
        pairs.push({ label: humanizeKey(suffix), value: `${before} → ${after}` });
        continue;
      }
    }
    handled.add(key);
    pairs.push({ label: humanizeKey(key), value: resolveValue(key, obj[key], maps) });
  }

  if (pairs.length === 0) return <span className="foundations__muted">—</span>;

  return (
    <div className="log-detail">
      {pairs.map((p) => (
        <span className="log-detail__item" key={p.label + p.value}>
          <span className="log-detail__key">{p.label}</span>
          <span className="log-detail__val">{p.value}</span>
        </span>
      ))}
    </div>
  );
}

type Column = { key: string; header: string; width?: number; render: (r: LogRow) => ReactNode };

const TABS: { id: Tab; label: string }[] = [
  { id: "activity", label: "Activity" },
  { id: "allocation", label: "Allocation history" },
  { id: "leave", label: "Leave approvals" },
  { id: "admin", label: "Admin actions" },
];

export function LogsPanel() {
  const [tab, setTab] = useState<Tab>("activity");

  const activity = useGetActivityLogsQuery(undefined, { skip: tab !== "activity" });
  const allocation = useGetAllocationHistoryLogsQuery(undefined, { skip: tab !== "allocation" });
  const leave = useGetLeaveApprovalLogsQuery(undefined, { skip: tab !== "leave" });
  const admin = useGetAdminActionLogsQuery(undefined, { skip: tab !== "admin" });

  // Lookup data so UUIDs in `details` can be shown as real names.
  const { data: teachersRaw } = useGetTeachersQuery();
  const { data: examsRaw } = useGetExamsQuery();
  const { data: roomsRaw } = useGetRoomsQuery();

  const maps = useMemo<NameMaps>(() => {
    const teacher = new Map<string, string>();
    arr(teachersRaw).forEach((t) => t.id && teacher.set(String(t.id), safeStr(t.name) || safeStr(t.email)));
    const exam = new Map<string, string>();
    arr(examsRaw).forEach((e) => e.id && exam.set(String(e.id), safeStr(e.course_code) || safeStr(e.course_name) || "Exam"));
    const room = new Map<string, string>();
    arr(roomsRaw).forEach((r) => r.id && room.set(String(r.id), safeStr(r.name) || "Room"));
    return { teacher, room, exam };
  }, [teachersRaw, examsRaw, roomsRaw]);

  const columns = useMemo<Record<Tab, Column[]>>(
    () => ({
      activity: [
        { key: "time", header: "Time", width: 160, render: (r) => fmtDateTime(r.created_at) },
        { key: "user", header: "User", render: (r) => safeStr(r.user_name) || <span className="foundations__muted">System</span> },
        { key: "role", header: "Role", width: 110, render: (r) => safeStr(r.user_role) || "—" },
        { key: "action", header: "Action", render: (r) => <strong>{humanizeAction(r.action)}</strong> },
        { key: "details", header: "Details", render: (r) => renderDetails(r.details, maps) },
      ],
      allocation: [
        { key: "time", header: "Updated", width: 160, render: (r) => fmtDateTime(r.updated_at ?? r.created_at) },
        { key: "course", header: "Course", render: (r) => <strong>{safeStr(r.course_name) || "—"}</strong> },
        { key: "teacher", header: "Teacher", render: (r) => safeStr(r.teacher_name) || "—" },
        { key: "room", header: "Room", render: (r) => safeStr(r.room_name) || "—" },
        { key: "examDate", header: "Exam date", width: 130, render: (r) => fmtDate(r.exam_date) },
        { key: "status", header: "Status", width: 130, render: (r) => statusPill(r.status) },
      ],
      leave: [
        { key: "time", header: "Reviewed", width: 160, render: (r) => fmtDateTime(r.updated_at ?? r.created_at) },
        { key: "teacher", header: "Teacher", render: (r) => <strong>{safeStr(r.teacher_name) || "—"}</strong> },
        { key: "dates", header: "Dates", render: (r) => `${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}` },
        { key: "status", header: "Status", width: 130, render: (r) => statusPill(r.status) },
        { key: "reason", header: "Reason", render: (r) => safeStr(r.reason) || "—" },
      ],
      admin: [
        { key: "time", header: "Time", width: 160, render: (r) => fmtDateTime(r.created_at) },
        { key: "admin", header: "Admin", render: (r) => <strong>{safeStr(r.admin_name) || "—"}</strong> },
        { key: "action", header: "Action", render: (r) => humanizeAction(r.action) },
        { key: "details", header: "Details", render: (r) => renderDetails(r.details, maps) },
      ],
    }),
    [maps],
  );

  const q = tab === "activity" ? activity : tab === "allocation" ? allocation : tab === "leave" ? leave : admin;
  const rows = useMemo(() => (Array.isArray(q.data) ? q.data : []), [q.data]);
  const cols = columns[tab];

  return (
    <div className="foundations">
      <div className="card foundations__card">
        <div className="foundations__page-head">
          <div>
            <h1 style={{ margin: 0 }}>Logs</h1>
            <p className="foundations__lead">Activity, allocation history, leave approvals and admin actions.</p>
          </div>
        </div>

        <div className="foundations__tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`foundations__tab ${tab === t.id ? "foundations__tab--active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {q.isLoading ? <p className="foundations__muted">Loading…</p> : null}
        {q.error ? <p className="foundations__error">Could not load logs.</p> : null}

        <div className="foundations__table-wrap">
          <table className="foundations__table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={cols.length} className="foundations__empty">
                    {q.isLoading ? "Loading…" : "No log entries."}
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={String(r.id ?? `${tab}-${idx}`)}>
                    {cols.map((c) => (
                      <td key={c.key}>{c.render(r)}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
