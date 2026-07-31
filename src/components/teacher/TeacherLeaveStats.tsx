import "@/styles/overview.css";
import { useMemo } from "react";
import { ChartCard, DonutChart, HBarList, VIZ } from "@/components/overview/charts";
import { leaveDays, sumBy } from "@/utils/stats";
import type { TeacherLeaveRow } from "@/types/teacher";

function monthLabel(iso: unknown): string {
  const d = new Date(String(iso ?? "").slice(0, 10));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function TeacherLeaveStats({ leaves }: { leaves: TeacherLeaveRow[] }) {
  const statusData = useMemo(() => {
    const c = { APPROVED: 0, PENDING: 0, REJECTED: 0 } as Record<string, number>;
    for (const l of leaves) {
      const s = String(l.status ?? "").toUpperCase();
      if (s in c) c[s]++;
    }
    return [
      { label: "Approved", value: c.APPROVED, color: VIZ.good },
      { label: "Pending", value: c.PENDING, color: VIZ.warning },
      { label: "Rejected", value: c.REJECTED, color: VIZ.critical },
    ];
  }, [leaves]);

  const daysByMonth = useMemo(
    () => sumBy(leaves, (l) => monthLabel(l.start_date), (l) => leaveDays(l.start_date, l.end_date), 8),
    [leaves],
  );

  return (
    <div className="ov-grid">
      <ChartCard title="Leave requests" subtitle="Your requests by status">
        <DonutChart centerLabel="requests" data={statusData} />
      </ChartCard>

      <ChartCard title="Leave days by month" subtitle="Total requested days per month">
        <HBarList data={daysByMonth} color={VIZ.blue} unit="days" />
      </ChartCard>
    </div>
  );
}
