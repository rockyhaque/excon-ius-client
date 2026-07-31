/** Small, dependency-free helpers for building stats & chart data across panels. */

/** Unwrap a list response that may be a bare array or a paginated { data: [...] }. */
export function asList<T = Record<string, unknown>>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  const d = (x as { data?: unknown } | undefined)?.data;
  return Array.isArray(d) ? (d as T[]) : [];
}

export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Hours between "HH:MM[:SS]" start and end (0 if invalid / negative). */
export function hoursBetween(start: unknown, end: unknown): number {
  const p = (v: unknown) => {
    const [h, m] = String(v ?? "").split(":");
    const hh = Number(h), mm = Number(m);
    return Number.isFinite(hh) ? hh + (Number.isFinite(mm) ? mm / 60 : 0) : NaN;
  };
  const a = p(start), b = p(end);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, b - a);
}

/** True if an ISO/date string is today or later. */
export function isUpcoming(dateStr: unknown): boolean {
  const d = new Date(String(dateStr ?? "").slice(0, 10));
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

/** Inclusive day count between two dates (1 for same-day). */
export function leaveDays(start: unknown, end: unknown): number {
  const a = new Date(String(start ?? "").slice(0, 10));
  const b = new Date(String(end ?? "").slice(0, 10));
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

/** Count items by a key → [{label,value}] sorted desc; blanks fold into "—". Optional top-N. */
export function countBy<T>(items: T[], keyFn: (t: T) => string, topN?: number): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = keyFn(it) || "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const out = [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  return topN ? out.slice(0, topN) : out;
}

/** Sum a numeric field by a key → [{label,value}] sorted desc. Optional top-N. */
export function sumBy<T>(items: T[], keyFn: (t: T) => string, valFn: (t: T) => number, topN?: number): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = keyFn(it) || "—";
    m.set(k, (m.get(k) ?? 0) + valFn(it));
  }
  const out = [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  return topN ? out.slice(0, topN) : out;
}

/** Bucket items by date → [{label: "Mon DD", value}] sorted chronologically. Optional cap on distinct dates. */
export function bucketByDate<T>(items: T[], dateFn: (t: T) => string, cap = 20): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const d = String(dateFn(it) ?? "").slice(0, 10);
    if (!d) continue;
    m.set(d, (m.get(d) ?? 0) + 1);
  }
  return [...m.keys()]
    .sort()
    .slice(0, cap)
    .map((d) => ({ label: fmtShortDate(d), value: m.get(d) ?? 0 }));
}

export function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Bucket items by year-month → [{label:"Mon YYYY", value}] chronological. */
export function bucketByMonth<T>(items: T[], dateFn: (t: T) => string): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const s = String(dateFn(it) ?? "");
    const d = new Date(s);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return [...m.keys()].sort().map((k) => {
    const [y, mo] = k.split("-");
    const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    return { label, value: m.get(k) ?? 0 };
  });
}
