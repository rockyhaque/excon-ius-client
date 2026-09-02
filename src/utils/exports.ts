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
  /* Explicit light background so a dark-mode browser doesn't auto-darken the printable page. */
  html, body { background: #fff; }
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

// ── Official IUS department routine (Date / Time / Code / Title / Batch) ─────
export type OfficialExamInput = {
  id?: string;
  dept?: string | null;
  course_code?: string | null;
  course_name?: string | null;
  batch?: string | null;
  exam_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  exam_type?: string | null;
  status?: string | null;
  invigilators?: string | null;
};

export type OfficialSitting = {
  date: string;
  start: string;
  end: string;
  course_code: string;
  course_name: string;
  batches: string;
  exam_ids: string[];
  invigilators: string;
};

export type OfficialTableRow = OfficialSitting & {
  showDate: boolean;
  dateSpan: number;
  showTime: boolean;
  timeSpan: number;
};

const ordinal = (n: number): string => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
};

/** "10th Batch" / "10th & 11th Batch" / "7th, 8th & 9th Batch" */
export function formatBatchList(batches: Array<string | number | null | undefined>): string {
  const nums = [
    ...new Set(
      batches
        .map((b) => Number(String(b ?? "").replace(/[^\d]/g, "")))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ].sort((a, b) => a - b);
  if (nums.length === 0) {
    const raw = batches.map((b) => String(b ?? "").trim()).filter(Boolean);
    return raw.length ? raw.join(", ") : "—";
  }
  const labels = nums.map(ordinal);
  if (labels.length === 1) return `${labels[0]} Batch`;
  if (labels.length === 2) return `${labels[0]} & ${labels[1]} Batch`;
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]} Batch`;
}

export function officialDateLabel(iso: string): string {
  const raw = String(iso ?? "").slice(0, 10);
  const dt = new Date(raw + "T00:00:00Z");
  if (isNaN(dt.getTime())) return raw;
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = dt.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  return `${dd}/${mm}/${dt.getUTCFullYear()} ${day}`;
}

export function officialExamTitle(examType?: string | null): string {
  const t = String(examType ?? "").toUpperCase();
  if (t === "MIDTERM") return "Mid-Term Examination Routine";
  if (t === "FINAL") return "Final Examination Routine";
  return "Examination Routine";
}

/** Collapse section sittings of the same course in the same slot into one row. */
export function groupOfficialSittings(exams: OfficialExamInput[]): OfficialSitting[] {
  const map = new Map<string, { row: OfficialSitting; nums: string[]; invs: Set<string> }>();
  const addInvs = (set: Set<string>, raw: string | null | undefined) => {
    String(raw ?? "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .forEach((n) => set.add(n));
  };
  for (const e of exams) {
    if (String(e.status ?? "").toUpperCase() === "CANCELLED") continue;
    const date = String(e.exam_date ?? "").slice(0, 10);
    const start = hhmm(e.start_time);
    const end = hhmm(e.end_time);
    const code = String(e.course_code ?? "").trim();
    if (!date || !code) continue;
    const key = `${date}|${start}|${end}|${code}`;
    const existing = map.get(key);
    const batch = String(e.batch ?? "").trim();
    if (existing) {
      if (e.id) existing.row.exam_ids.push(String(e.id));
      if (batch) existing.nums.push(batch);
      addInvs(existing.invs, e.invigilators);
    } else {
      const invs = new Set<string>();
      addInvs(invs, e.invigilators);
      map.set(key, {
        nums: batch ? [batch] : [],
        invs,
        row: {
          date,
          start,
          end,
          course_code: code,
          course_name: String(e.course_name ?? "").trim(),
          batches: "",
          exam_ids: e.id ? [String(e.id)] : [],
          invigilators: "",
        },
      });
    }
  }
  return [...map.values()]
    .map(({ row, nums, invs }) => ({ ...row, batches: formatBatchList(nums), invigilators: [...invs].sort().join(", ") }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.start.localeCompare(b.start) ||
        a.course_code.localeCompare(b.course_code),
    );
}

/** Attach date/time rowspans for the official paper table. */
export function officialTableRows(exams: OfficialExamInput[]): OfficialTableRow[] {
  const sittings = groupOfficialSittings(exams);
  const out: OfficialTableRow[] = [];
  let i = 0;
  while (i < sittings.length) {
    const date = sittings[i]!.date;
    let dateEnd = i;
    while (dateEnd < sittings.length && sittings[dateEnd]!.date === date) dateEnd++;
    const dateSpan = dateEnd - i;
    let j = i;
    let dateShown = false;
    while (j < dateEnd) {
      const start = sittings[j]!.start;
      const end = sittings[j]!.end;
      let timeEnd = j;
      while (
        timeEnd < dateEnd &&
        sittings[timeEnd]!.start === start &&
        sittings[timeEnd]!.end === end
      ) {
        timeEnd++;
      }
      const timeSpan = timeEnd - j;
      let timeShown = false;
      for (let k = j; k < timeEnd; k++) {
        const s = sittings[k]!;
        out.push({
          ...s,
          showDate: !dateShown,
          dateSpan,
          showTime: !timeShown,
          timeSpan,
        });
        dateShown = true;
        timeShown = true;
      }
      j = timeEnd;
    }
    i = dateEnd;
  }
  return out;
}

const coordinatorOf = (dept: string): string => {
  const d = dept.toLowerCase();
  if (d.includes("textile")) return "Coordinator, BSc in Textile Program";
  if (d.includes("mba")) return "Coordinator, MBA Program";
  if (d.includes("business") || d.includes("bba")) return "Coordinator, BBA Program";
  return `Coordinator, ${dept}`;
};

const headOf = (dept: string): string => {
  const name = dept.replace(/^Department of /i, "");
  return `Head, Dept. of ${name}`;
};

const IUS_ROUTINE_STYLES = `
  * { box-sizing: border-box; }
  html, body { background: #fff; }
  body { font-family: "Times New Roman", Times, Georgia, serif; color: #111; padding: 16px 22px; }
  .sheet { page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .hdr-left { font-weight: 700; font-size: 14px; }
  .hdr-right { text-align: right; font-weight: 700; font-size: 15px; color: #5c0931; }
  .hdr-right small { display: block; font-weight: 400; font-size: 11px; color: #444; }
  h1.rtitle { text-align: center; font-size: 18px; margin: 10px 0 2px; }
  .sem { text-align: center; font-size: 14px; margin: 0 0 12px; }
  table.ius { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.ius th, table.ius td { border: 1px solid #111; padding: 6px 8px; vertical-align: middle; }
  table.ius th { text-align: center; background: #f4f4f4; font-weight: 700; }
  table.ius td.date, table.ius td.time { text-align: center; font-weight: 600; white-space: nowrap; }
  .notes { margin: 12px 0 0; padding-left: 18px; font-size: 12px; }
  .notes li { margin: 3px 0; }
  .sign { display: flex; justify-content: space-between; gap: 16px; margin-top: 52px; }
  .sign .blk { width: 30%; text-align: center; font-size: 12px; }
  .sign .line { border-top: 1px solid #111; margin-top: 44px; padding-top: 6px; }
  .addr { text-align: center; font-size: 10.5px; color: #333; margin-top: 28px; border-top: 1px solid #ccc; padding-top: 8px; }
  @media print { body { padding: 8px 12px; } }
`;

function officialSheetHtml(
  dept: string,
  rows: OfficialTableRow[],
  semester: string,
  examType?: string | null,
): string {
  const body = rows
    .map((r) => {
      const dateTd = r.showDate
        ? `<td class="date" rowspan="${r.dateSpan}">${escHtml(officialDateLabel(r.date))}</td>`
        : "";
      const timeTd = r.showTime
        ? `<td class="time" rowspan="${r.timeSpan}">${escHtml(timeRange(r.start, r.end))}</td>`
        : "";
      return `<tr>${dateTd}${timeTd}<td>${escHtml(r.course_code)}</td><td>${escHtml(r.course_name)}</td><td>${escHtml(r.batches)}</td></tr>`;
    })
    .join("");
  return `<section class="sheet">
    <div class="hdr">
      <div class="hdr-left">${escHtml(dept)}</div>
      <div class="hdr-right">${escHtml(UNIVERSITY)}<small>The International University of Scholars</small></div>
    </div>
    <h1 class="rtitle">${escHtml(officialExamTitle(examType))}</h1>
    <div class="sem">Semester: ${escHtml(semester)}</div>
    <table class="ius">
      <thead><tr><th style="width:18%">Date</th><th style="width:16%">Time</th><th style="width:16%">Course Code</th><th>Course Title</th><th style="width:18%">Batch</th></tr></thead>
      <tbody>${body || `<tr><td colspan="5" style="text-align:center">No exams scheduled.</td></tr>`}</tbody>
    </table>
    <ul class="notes">
      <li>Before appearing in the exam, you have to ensure your course registration. You should collect your admit card.</li>
      <li>You must bring your admit card to the examination hall.</li>
      <li>Room numbers will be announced later.</li>
    </ul>
    <div class="sign">
      <div class="blk"><div class="line">${escHtml(coordinatorOf(dept))}</div></div>
      <div class="blk"><div class="line">${escHtml(headOf(dept))}</div></div>
      <div class="blk"><div class="line">Controller of Examinations,<br/>University of Scholars</div></div>
    </div>
    <div class="addr">The International University of Scholars · Kamal Ataturk Avenue, Banani, Dhaka</div>
  </section>`;
}

/** Print the official IUS routine: one sheet per department (or a single department). */
export function printOfficialRoutine(
  exams: OfficialExamInput[],
  opts: { semester: string; examType?: string | null; dept?: string },
): boolean {
  const filtered = byDept(exams, opts.dept);
  const depts = deptsOf(filtered);
  const pages =
    depts.length === 0
      ? "<p>No exams to print.</p>"
      : depts
          .map((dept) => officialSheetHtml(dept, officialTableRows(filtered.filter((e) => String(e.dept ?? "") === dept)), opts.semester, opts.examType))
          .join("");
  const title = `${UNIVERSITY} — ${officialExamTitle(opts.examType)}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escHtml(title)}</title>
    <style>${IUS_ROUTINE_STYLES}</style></head><body>${pages}
    <script>window.onload=function(){window.print();}</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
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
