import "@/styles/teacher.css";
import { useMemo } from "react";
import { useGetRulesQuery } from "@/redux/features/allocations/allocations.api";
import { useSkipTeacherApi } from "@/hooks/useTeacherProfile";
import { asList } from "@/utils/stats";
import type { TeacherRuleRow } from "@/types/teacher";

const CATEGORY_LABELS: Record<string, string> = {
  BASIC: "Basic rules",
  HALL_ENTRY: "Hall entry",
};

function prettyCategory(cat: string): string {
  return CATEGORY_LABELS[cat] ?? (cat === "—" ? "Other" : cat);
}

export function TeacherRulesCard() {
  const skipApi = useSkipTeacherApi();
  const { data, isLoading, error } = useGetRulesQuery(undefined, { skip: skipApi });

  const grouped = useMemo(() => {
    const rules = asList<TeacherRuleRow>(data);
    const m = new Map<string, TeacherRuleRow[]>();
    for (const r of rules) {
      const k = String(r.category ?? "").toUpperCase() || "—";
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    // Keep BASIC then HALL_ENTRY first, then any others.
    const order = ["BASIC", "HALL_ENTRY"];
    return [...m.entries()].sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
    });
  }, [data]);

  return (
    <div className="foundations">
      <div className="card foundations__card">
        <div className="foundations__page-head">
          <div>
            <h2>Invigilation rules</h2>
            <p className="foundations__lead">Guidelines for exam duty and hall entry.</p>
          </div>
        </div>

        {skipApi ? (
          <p className="foundations__muted">Sign in to load the rules.</p>
        ) : isLoading ? (
          <p className="foundations__muted">Loading…</p>
        ) : error ? (
          <p className="foundations__error">Could not load rules.</p>
        ) : grouped.length === 0 ? (
          <div className="foundations__empty">No rules published yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <div className="teacher-stat__label" style={{ marginBottom: 8 }}>
                  {prettyCategory(cat)}
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  }}
                >
                  {items.map((r) => (
                    <div
                      key={String(r.id)}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: "12px 14px",
                        background: "#fff",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                        {String(r.title ?? "Rule")}
                      </div>
                      <div style={{ fontSize: "0.88rem", color: "#4b5563", whiteSpace: "pre-wrap" }}>
                        {String(r.content ?? "")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
