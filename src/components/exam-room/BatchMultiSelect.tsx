import { useEffect, useMemo, useRef, useState } from "react";
import type { Batch } from "@/types/foundations";

type Dept = { id: string; name: string };

/** Compact multi-select dropdown for choosing running batches (grouped by department). */
export function BatchMultiSelect({
  batches,
  departments,
  groupByDept,
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: {
  batches: Batch[];
  departments: Dept[];
  groupByDept: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const total = batches.length;
  const selectedCount = useMemo(() => batches.filter((b) => selected.has(String(b.id))).length, [batches, selected]);

  const summary =
    total === 0
      ? "No running batches"
      : selectedCount === 0
        ? "Select batches"
        : selectedCount === total
          ? `All running batches (${total})`
          : `${selectedCount} of ${total} batches`;

  const label = (b: Batch) => `Batch ${b.number ?? b.name}`;

  const groups: { dept: Dept | null; items: Batch[] }[] = groupByDept
    ? departments
        .map((d) => ({ dept: d, items: batches.filter((b) => String(b.dept_id) === d.id) }))
        .filter((g) => g.items.length > 0)
    : [{ dept: null, items: batches }];

  return (
    <div className="foundations__ms" ref={ref}>
      <button
        type="button"
        className="foundations__ms-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={total === 0}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selectedCount === 0 ? "foundations__ms-placeholder" : undefined}>{summary}</span>
        <span className="foundations__ms-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="foundations__ms-panel" role="listbox" aria-multiselectable>
          <div className="foundations__ms-bar">
            <button type="button" className="foundations__ms-link" onClick={onSelectAll}>
              Select all
            </button>
            <button type="button" className="foundations__ms-link" onClick={onClear}>
              Clear
            </button>
            <span className="foundations__ms-count">{selectedCount} selected</span>
          </div>

          <div className="foundations__ms-list">
            {groups.map((g, gi) => (
              <div key={g.dept?.id ?? gi} className="foundations__ms-group">
                {g.dept ? <div className="foundations__ms-group-label">{g.dept.name}</div> : null}
                {g.items.map((b) => {
                  const id = String(b.id);
                  const checked = selected.has(id);
                  return (
                    <label key={id} className={checked ? "foundations__ms-item foundations__ms-item--on" : "foundations__ms-item"}>
                      <input type="checkbox" checked={checked} onChange={() => onToggle(id)} />
                      <span>{label(b)}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
