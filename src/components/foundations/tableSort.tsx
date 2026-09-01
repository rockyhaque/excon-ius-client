import { useState, type CSSProperties } from "react";

export type SortDir = "asc" | "desc";
export type SortState<K extends string> = { key: K; dir: SortDir };

/** Toggle-on-click sort state: same column flips direction, new column starts ascending. */
export function useSort<K extends string>(initialKey: K, initialDir: SortDir = "asc") {
  const [sort, setSort] = useState<SortState<K>>({ key: initialKey, dir: initialDir });
  const onSort = (key: K) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  return { sort, onSort };
}

/** Multiplier so a comparator written ascending honours the active direction. */
export function sortSign(dir: SortDir) {
  return dir === "asc" ? 1 : -1;
}

/** A clickable, sortable table header cell that shows the current sort direction. */
export function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  style,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  style?: CSSProperties;
}) {
  const active = sort.key === sortKey;
  return (
    <th style={style}>
      <button
        type="button"
        className="foundations__th-sort"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <span className={active ? "foundations__sort-ind foundations__sort-ind--active" : "foundations__sort-ind"}>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
