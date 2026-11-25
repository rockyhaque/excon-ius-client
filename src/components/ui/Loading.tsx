import type { ReactNode } from "react";

function Spinner({ size = 22, light = false }: { size?: number; light?: boolean }) {
  return (
    <span
      className={light ? "ius-spinner ius-spinner--light" : "ius-spinner"}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/** Centered page/section spinner. Use this wherever data is still loading. */
export function LoadingSpinner({
  size = 36,
  full = false,
  compact = false,
  light = false,
  label = "Loading",
}: {
  size?: number;
  full?: boolean;
  compact?: boolean;
  light?: boolean;
  label?: string;
}) {
  const place = compact ? "ius-spinner-center ius-spinner-center--compact" : full ? "ius-spinner-center ius-spinner-center--full" : "ius-spinner-center";
  const Tag = compact ? "span" : "div";
  return (
    <Tag className={place} role="status" aria-live="polite" aria-busy="true">
      <Spinner size={size} light={light} />
      <span className="ius-spinner__sr">{label}</span>
    </Tag>
  );
}

export function LoadingInline({
  label = "Loading…",
  size = 18,
}: {
  label?: string;
  size?: number;
}) {
  return (
    <span className="ius-loading-inline" role="status" aria-live="polite">
      <Spinner size={size} />
      <span>{label}</span>
    </span>
  );
}

export function LoadingCard({
  title = "Loading…",
  subtitle,
}: {
  title?: string;
  subtitle?: ReactNode;
}) {
  return (
    <div className="card ius-loading-card" role="status" aria-live="polite">
      <Spinner size={26} />
      <div>
        <div className="ius-loading-card__title">{title}</div>
        {subtitle ? <div className="ius-loading-card__subtitle">{subtitle}</div> : null}
      </div>
    </div>
  );
}

export function LoadingScreen({
  title = "Loading…",
  subtitle,
}: {
  title?: string;
  subtitle?: ReactNode;
}) {
  return (
    <div className="ius-loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="ius-loading-screen__panel">
        <Spinner size={28} light />
        <div className="ius-loading-screen__title">{title}</div>
        {subtitle ? <div className="ius-loading-screen__subtitle">{subtitle}</div> : null}
      </div>
    </div>
  );
}

