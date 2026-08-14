/**
 * Printable / downloadable exports that serve teachers & staff:
 *  - Teacher duty slips (PDF)     — one page per teacher, their invigilation duties
 *  - Per-room hall packets (PDF)  — one page per exam+room: invigilators + attendance sheet
 *  - Exam timetable (CSV)         — the routine, Excel-friendly
 *  - Invigilation routine (CSV)   — published duties
 *
 * PDFs use the app's established "print-friendly HTML in a pop-up + window.print()" pattern
 * (no PDF library). CSVs download via a Blob. All builders accept an optional dept filter.
 */

import type { PublishedAllocationRow } from "@/types/teacher";

const UNIVERSITY = "University of Scholars";

// ── formatting ──────────────────────────────────────────────────────────────
export const escHtml = (v: unknown): string =>
  String(v ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string),
  );

const escCsv = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const str = String(v);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const hhmm = (v?: string | null): string => (v ? String(v).slice(0, 5) : "");
const timeRange = (a?: string | null, b?: string | null): string => {
  const s = hhmm(a);
  const e = hhmm(b);
  return s ? `${s}${e ? `–${e}` : ""}` : "—";
};

const fmtDate = (d?: string | null): string => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? String(d).slice(0, 10)
    : dt.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
};

const dayName = (d?: string | null): string => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString(undefined, { weekday: "long" });
};

const classLabel = (r: { dept?: string | null; batch?: string | null; section?: string | null }): string =>
  [r.dept, r.batch ? `B${r.batch}` : "", r.section ? `Sec ${r.section}` : ""]
    .filter((p) => p && String(p).trim())
    .join(" · ") || "—";

// ── shared helpers ──────────────────────────────────────────────────────────
type DeptRow = { dept?: string | null };
type DatedRow = { exam_date?: string | null; start_time?: string | null };

const byDept = <T extends DeptRow>(rows: T[], dept?: string): T[] =>
  dept ? rows.filter((r) => String(r.dept ?? "") === dept) : rows;

const sortByDateTime = <T extends DatedRow>(rows: T[]): T[] =>
  rows
    .slice()
    .sort(
      (a, b) =>
        String(a.exam_date ?? "").localeCompare(String(b.exam_date ?? "")) ||
        String(a.start_time ?? "").localeCompare(String(b.start_time ?? "")),
    );

/** Distinct, sorted department names present in the rows (for a dept filter dropdown). */
export const deptsOf = (rows: DeptRow[]): string[] =>
  [...new Set(rows.map((r) => (r.dept ? String(r.dept) : "")).filter(Boolean))].sort();

// ── PDF (print) + CSV (download) primitives ────────────────────────────────
const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #111827; padding: 28px; }
  h1 { margin: 0 0 2px; font-size: 19px; }
  h1.brand { color: #5c0931; }
  h3 { font-size: 13px; margin: 14px 0 6px; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  th { background: #fafafa; font-weight: 700; }
  .doc { page-break-after: always; }
  .doc:last-child { page-break-after: auto; }
  .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }
  .who { font-size: 15px; font-weight: 700; margin: 0 0 2px; }
  .sub { color: #6b7280; font-size: 12px; margin: 0 0 10px; }
  .kv th { width: 150px; background: #fff; color: #6b7280; font-weight: 600; border-bottom: none; }
  .kv td { border-bottom: none; }
  .sign { margin-top: 22px; display: flex; gap: 40px; font-size: 12px; color: #374151; }
  .sign div { border-top: 1px solid #9ca3af; padding-top: 4px; min-width: 190px; }
  @media print { body { padding: 0; } }
`;

/** Open a print-ready window with the given body. Returns false if the pop-up was blocked. */
export function printDocument(title: string, bodyHtml: string): boolean {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escHtml(title)}</title>
    <style>${PRINT_STYLES}</style></head><body>${bodyHtml}
    <script>window.onload=function(){window.print();}</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

/** Trigger a CSV download (BOM prefixed so Excel reads UTF-8 correctly). */
export function downloadCsv(
  filename: string,
  header: string[],
  rows: Array<Array<string | number | null | undefined>>,
): void {
  const body = [header, ...rows].map((r) => r.map(escCsv).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Teacher duty slips (PDF) ────────────────────────────────────────────────
export function buildDutySlipsHtml(rows: PublishedAllocationRow[], opts: { dept?: string } = {}): string {
  const filtered = sortByDateTime(byDept(rows, opts.dept));
  const groups = new Map<string, PublishedAllocationRow[]>();
  for (const r of filtered) {
    const key = r.teacher_id || r.teacher_name || "—";
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }
  const generated = new Date().toLocaleDateString();

  const slips = [...groups.values()]
    .sort((a, b) => String(a[0].teacher_name).localeCompare(String(b[0].teacher_name)))
    .map((duties) => {
      const t = duties[0];
      const trs = duties
        .map(
          (d) => `<tr>
            <td>${escHtml(fmtDate(d.exam_date))}</td>
            <td>${escHtml(timeRange(d.start_time, d.end_time))}</td>
            <td><strong>${escHtml(d.course_code || "")}</strong> ${escHtml(d.course_name)}</td>
            <td>${escHtml(classLabel(d))}</td>
            <td>${escHtml(d.room_name || "—")}</td>
            <td>${d.expected_students ?? "—"}</td>
          </tr>`,
        )
        .join("");
      return `<section class="doc">
        <h1 class="brand">${escHtml(UNIVERSITY)}</h1>
        <div class="meta">Invigilation Duty Slip · Generated ${escHtml(generated)}</div>
        <div class="card">
          <p class="who">${escHtml(t.teacher_name)}${t.employee_id ? ` · ${escHtml(t.employee_id)}` : ""}</p>
          <p class="sub">${escHtml(t.designation || "Faculty")}${
            t.teacher_email ? ` · ${escHtml(t.teacher_email)}` : ""
          } · ${duties.length} dut${duties.length === 1 ? "y" : "ies"}</p>
          <table>
            <thead><tr><th>Date</th><th>Time</th><th>Course</th><th>Class</th><th>Room</th><th>Students</th></tr></thead>
            <tbody>${trs}</tbody>
          </table>
          <div class="sign"><div>Invigilator signature</div><div>Controller of Examinations</div></div>
        </div>
      </section>`;
    })
    .join("");

  return slips || "<p>No duties to print.</p>";
}

// ── Per-room hall packets (PDF) ─────────────────────────────────────────────
function attendanceRows(seats: number | null): string {
  const n = Math.min(Math.max(seats ?? 30, 20), 60); // sensible number of blank sign-in rows
  let out = "";
  for (let i = 1; i <= n; i++) out += `<tr><td>${i}</td><td></td><td></td><td></td></tr>`;
  return out;
}

export function buildHallPacketsHtml(rows: PublishedAllocationRow[], opts: { dept?: string } = {}): string {
  const filtered = byDept(rows, opts.dept);
  // Group by exam + room so multiple invigilators of the same hall share one packet (see fix A).
  const groups = new Map<string, PublishedAllocationRow[]>();
  for (const r of filtered) {
    const key = `${r.exam_id}|${r.room_id}`;
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  const packets = [...groups.values()]
    .sort(
      (a, b) =>
        String(a[0].exam_date).localeCompare(String(b[0].exam_date)) ||
        String(a[0].start_time ?? "").localeCompare(String(b[0].start_time ?? "")) ||
        String(a[0].room_name).localeCompare(String(b[0].room_name)),
    )
    .map((group) => {
      const e = group[0];
      const invigList = group
        .map(
          (g) =>
            `<li>${escHtml(g.teacher_name)}${g.employee_id ? ` (${escHtml(g.employee_id)})` : ""}` +
            ` <span style="color:#9ca3af">— signature: ______________</span></li>`,
        )
        .join("");
      const seats = e.expected_students ?? null;
      const cap = e.room_capacity ?? null;
      return `<section class="doc">
        <h1 class="brand">${escHtml(UNIVERSITY)} — Examination Hall Packet</h1>
        <div class="meta">${escHtml(fmtDate(e.exam_date))} · ${escHtml(timeRange(e.start_time, e.end_time))}</div>
        <div class="card">
          <table class="kv">
            <tr><th>Course</th><td><strong>${escHtml(e.course_code || "")}</strong> ${escHtml(e.course_name)}</td></tr>
            <tr><th>Class</th><td>${escHtml(classLabel(e))}</td></tr>
            <tr><th>Room</th><td>${escHtml(e.room_name || "—")}${cap != null ? ` (capacity ${cap})` : ""}</td></tr>
            <tr><th>Expected students</th><td>${seats != null ? seats : "—"}</td></tr>
            <tr><th>Invigilator(s)</th><td><ul style="margin:0;padding-left:18px">${invigList}</ul></td></tr>
          </table>
        </div>
        <h3>Attendance &amp; seating sheet</h3>
        <table>
          <thead><tr><th style="width:44px">#</th><th>Student ID</th><th>Name</th><th>Signature</th></tr></thead>
          <tbody>${attendanceRows(seats)}</tbody>
        </table>
      </section>`;
    })
    .join("");

  return packets || "<p>No published duties to print.</p>";
}

// ── CSV exports ─────────────────────────────────────────────────────────────
export type TimetableExam = {
  course_code?: string | null;
  course_name?: string | null;
  dept?: string | null;
  batch?: string | null;
  section?: string | null;
  exam_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  exam_type?: string | null;
  status?: string | null;
  room_name?: string | null;
  room_building?: string | null;
  room_capacity?: number | null;
  expected_students?: number | null;
};

/** Exam timetable → { header, rows } for downloadCsv. */
export function timetableCsv(rows: TimetableExam[], opts: { dept?: string } = {}) {
  const filtered = sortByDateTime(byDept(rows, opts.dept));
  const header = [
    "#", "Date", "Day", "Start", "End", "Department", "Batch", "Section",
    "Course Code", "Course Name", "Type", "Room", "Building", "Capacity",
    "Expected Students", "Status",
  ];
  const body = filtered.map((r, i) => [
    i + 1,
    (r.exam_date ?? "").slice(0, 10),
    dayName(r.exam_date),
    hhmm(r.start_time),
    hhmm(r.end_time),
    r.dept ?? "",
    r.batch ?? "",
    r.section ?? "",
    r.course_code ?? "",
    r.course_name ?? "",
    r.exam_type ?? "",
    r.room_name ?? "",
    r.room_building ?? "",
    r.room_capacity ?? "",
    r.expected_students ?? "",
    r.status ?? "",
  ]);
  return { header, rows: body };
}

/** Published invigilation routine → { header, rows } for downloadCsv. */
export function allocationCsv(rows: PublishedAllocationRow[], opts: { dept?: string } = {}) {
  const filtered = sortByDateTime(byDept(rows, opts.dept));
  const header = [
    "#", "Date", "Day", "Start", "End", "Department", "Batch", "Section",
    "Course Code", "Course Name", "Room", "Capacity", "Expected Students",
    "Invigilator", "Employee ID", "Designation",
  ];
  const body = filtered.map((r, i) => [
    i + 1,
    (r.exam_date ?? "").slice(0, 10),
    dayName(r.exam_date),
    hhmm(r.start_time),
    hhmm(r.end_time),
    r.dept ?? "",
    r.batch ?? "",
    r.section ?? "",
    r.course_code ?? "",
    r.course_name ?? "",
    r.room_name ?? "",
    r.room_capacity ?? "",
    r.expected_students ?? "",
    r.teacher_name ?? "",
    r.employee_id ?? "",
    r.designation ?? "",
  ]);
  return { header, rows: body };
}

/** A dated filename stamp, e.g. IUS_Duty_Slips_2026-08-15.csv */
export const stampName = (base: string, ext: string): string =>
  `IUS_${base}_${new Date().toISOString().slice(0, 10)}.${ext}`;
