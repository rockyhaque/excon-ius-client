import { useEffect, useMemo, useRef, useState } from "react";
import type { Batch } from "@/types/foundations";

type Dept = { id: string; name: string; code?: string };

/** Compact, searchable multi-select for running batches, grouped by department. */
export function BatchMultiSelect({
  batches,
  departments,
  groupByDept,
  selected,
  onToggle,
  onSetMany,
}: {
  batches: Batch[];
  departments: Dept[];
  groupByDept: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSetMany: (ids: string[], on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  // reset the search each time the popover closes
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const total = batches.length;
  const selectedCount = useMemo(() => batches.filter((b) => selected.has(String(b.id))).length, [batches, selected]);
  const label = (b: Batch) => `Batch ${b.number ?? b.name}`;
  const q = query.trim().toLowerCase();

  // Build (optionally grouped) lists, filtered by the search query.
  const rawGroups: { dept: Dept | null; items: Batch[] }[] = groupByDept
    ? departments
        .map((d) => ({ dept: d, items: batches.filter((b) => String(b.dept_id) === d.id) }))
        .filter((g) => g.items.length > 0)
    : [{ dept: null, items: batches }];

  const groups = rawGroups
    .map((g) => {
      if (!q) return g;
      const deptMatches = g.dept
        ? g.dept.name.toLowerCase().includes(q) || (g.dept.code ?? "").toLowerCase().includes(q)
        : false;
      const items = deptMatches ? g.items : g.items.filter((b) => label(b).toLowerCase().includes(q) || String(b.number ?? b.name).includes(q));
      return { ...g, items };
    })
    .filter((g) => g.items.length > 0);

  const visibleIds = groups.flatMap((g) => g.items.map((b) => String(b.id)));

  const summary =
    total === 0
      ? "No running batches"
      : selectedCount === 0
        ? "Select batches"
        : selectedCount === total
          ? `All running batches (${total})`
          : `${selectedCount} of ${total} batches`;

  const isOpenGroup = (deptId: string | undefined) => !groupByDept || !!q || (deptId ? expanded.has(deptId) : true);
  const toggleGroup = (deptId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });

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
          <div className="foundations__ms-search">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search department or batch number…"
              aria-label="Search batches"
              autoFocus
            />
          </div>

          <div className="foundations__ms-bar">
            <button type="button" className="foundations__ms-link" onClick={() => onSetMany(visibleIds, true)}>
              {q ? "Select shown" : "Select all"}
            </button>
            <button type="button" className="foundations__ms-link" onClick={() => onSetMany(visibleIds, false)}>
              Clear
            </button>
            <span className="foundations__ms-count">{selectedCount} selected</span>
          </div>

          <div className="foundations__ms-list">
            {groups.length === 0 ? (
              <div className="foundations__ms-empty">No batches match “{query}”.</div>
            ) : (
              groups.map((g, gi) => {
                const deptId = g.dept?.id;
                const openGroup = isOpenGroup(deptId);
                const selInGroup = g.items.filter((b) => selected.has(String(b.id))).length;
                return (
                  <div key={deptId ?? gi} className="foundations__ms-group">
                    {g.dept ? (
                      <button
                        type="button"
                        className="foundations__ms-group-head"
                        onClick={() => deptId && toggleGroup(deptId)}
                        aria-expanded={openGroup}
                      >
                        <span className={openGroup ? "foundations__ms-gcaret foundations__ms-gcaret--open" : "foundations__ms-gcaret"} aria-hidden>
                          ▸
                        </span>
                        {g.dept.code ? <span className="foundations__ms-gcode">{g.dept.code}</span> : null}
                        <span className="foundations__ms-gname">{g.dept.name}</span>
                        <span className="foundations__ms-gcount">
                          {selInGroup}/{g.items.length}
                        </span>
                      </button>
                    ) : null}
                    {openGroup
                      ? g.items.map((b) => {
                          const id = String(b.id);
                          const checked = selected.has(id);
                          return (
                            <label key={id} className={checked ? "foundations__ms-item foundations__ms-item--on" : "foundations__ms-item"}>
                              <input type="checkbox" checked={checked} onChange={() => onToggle(id)} />
                              <span>{label(b)}</span>
                            </label>
                          );
                        })
                      : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
