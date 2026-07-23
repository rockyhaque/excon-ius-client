import { type ReactNode } from "react";

/**
 * Lightweight, dependency-free chart primitives for the admin overview.
 * Colors follow the data-viz method: sequential single-hue blue for magnitude,
 * a CVD-validated categorical pair (blue/orange) for identity, and the reserved
 * status palette (good/warning/critical) — always paired with a label, never color alone.
 */
export const VIZ = {
  blue: "#2a78d6", // sequential / categorical slot 1
  orange: "#eb6834", // categorical slot 2
  neutral: "#cbd5e1", // "none / unassigned"
  good: "#0ca30c",
  warning: "#e0900a",
  critical: "#d03b3b",
  grid: "#eceef1",
  axis: "#c3c2b7",
  ink: "#111827",
  sub: "#4b5563",
  muted: "#6b7280",
  surface: "#ffffff",
} as const;

const compact = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}K` : String(n));

function EmptyState({ label }: { label: string }) {
  return <div className="ov-chart__empty">{label}</div>;
}

/* ── Donut (part-to-whole) ────────────────────────────────────────────── */

type Slice = { label: string; value: number; color: string };

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arc(cx: number, cy: number, rO: number, rI: number, start: number, end: number) {
  const [x0, y0] = polar(cx, cy, rO, end);
  const [x1, y1] = polar(cx, cy, rO, start);
  const [x2, y2] = polar(cx, cy, rI, start);
  const [x3, y3] = polar(cx, cy, rI, end);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${x0} ${y0} A ${rO} ${rO} 0 ${large} 0 ${x1} ${y1} L ${x2} ${y2} A ${rI} ${rI} 0 ${large} 1 ${x3} ${y3} Z`;
}

export function DonutChart({ data, centerLabel }: { data: Slice[]; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return <EmptyState label="No data yet." />;

  const size = 176, cx = size / 2, cy = size / 2, rO = 82, rI = 52;
  const gap = data.filter((d) => d.value > 0).length > 1 ? 2 : 0; // 2° surface gap between segments
  let angle = 0;

  return (
    <div className="ov-donut">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={centerLabel ?? "donut chart"}>
        {data.map((d) => {
          if (d.value <= 0) return null;
          const sweep = (d.value / total) * 360;
          const start = angle + gap / 2;
          const end = angle + sweep - gap / 2;
          angle += sweep;
          return (
            <path key={d.label} d={arc(cx, cy, rO, rI, start, Math.max(start, end))} fill={d.color}>
              <title>{`${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}</title>
            </path>
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="ov-donut__total">{compact(total)}</text>
        {centerLabel ? <text x={cx} y={cy + 16} textAnchor="middle" className="ov-donut__caption">{centerLabel}</text> : null}
      </svg>
      <ul className="ov-legend">
        {data.map((d) => (
          <li key={d.label}>
            <span className="ov-legend__dot" style={{ background: d.color }} />
            <span className="ov-legend__label">{d.label}</span>
            <span className="ov-legend__value">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Horizontal bars (magnitude) ──────────────────────────────────────── */

type Bar = { label: string; value: number; color?: string; sub?: string };

export function HBarList({ data, color = VIZ.blue, unit }: { data: Bar[]; color?: string; unit?: string }) {
  if (data.length === 0) return <EmptyState label="No data yet." />;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="ov-bars">
      {data.map((d) => (
        <div className="ov-bars__row" key={d.label} title={`${d.label}: ${d.value}${unit ? " " + unit : ""}`}>
          <div className="ov-bars__label">
            {d.label}
            {d.sub ? <span className="ov-bars__sub"> {d.sub}</span> : null}
          </div>
          <div className="ov-bars__track">
            <div
              className="ov-bars__fill"
              style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0)}%`, background: d.color ?? color }}
            />
          </div>
          <div className="ov-bars__value">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Area (trend over time) ───────────────────────────────────────────── */

type Point = { label: string; value: number };

export function AreaChart({ data, color = VIZ.blue }: { data: Point[]; color?: string }) {
  if (data.length === 0) return <EmptyState label="No upcoming exams." />;
  const W = 640, H = 200, padL = 28, padR = 12, padT = 14, padB = 28;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const x = (i: number) => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => padT + ih - (v / max) * ih;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(n - 1).toFixed(1)} ${padT + ih} L ${x(0).toFixed(1)} ${padT + ih} Z`;
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const labelEvery = Math.ceil(n / 7);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="upcoming exams over time" className="ov-area">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={VIZ.grid} strokeWidth={1} />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" className="ov-axis">{t}</text>
        </g>
      ))}
      <path d={area} fill={color} fillOpacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={d.label}>
          {(n <= 14 || i === n - 1) ? <circle cx={x(i)} cy={y(d.value)} r={3.5} fill={color} stroke={VIZ.surface} strokeWidth={2}><title>{`${d.label}: ${d.value}`}</title></circle> : null}
          {i % labelEvery === 0 || i === n - 1 ? <text x={x(i)} y={H - 8} textAnchor="middle" className="ov-axis">{d.label}</text> : null}
        </g>
      ))}
    </svg>
  );
}

/* ── Chart card shell ─────────────────────────────────────────────────── */

export function ChartCard({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`ov-card${wide ? " ov-card--wide" : ""}`}>
      <header className="ov-card__head">
        <h2 className="ov-card__title">{title}</h2>
        {subtitle ? <p className="ov-card__sub">{subtitle}</p> : null}
      </header>
      <div className="ov-card__body">{children}</div>
    </section>
  );
}
