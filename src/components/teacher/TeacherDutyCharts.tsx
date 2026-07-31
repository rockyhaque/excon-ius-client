import "@/styles/overview.css";
import { useMemo } from "react";
import { AreaChart, ChartCard, DonutChart, HBarList, VIZ } from "@/components/overview/charts";
import { bucketByDate, countBy, num, sumBy } from "@/utils/stats";
import type { PublishedAllocationRow } from "@/types/teacher";

const CYCLE = [VIZ.blue, VIZ.orange, VIZ.good, VIZ.warning, VIZ.critical, VIZ.neutral];

function withColors(rows: { label: string; value: number }[]) {
  return rows.map((r, i) => ({ ...r, color: CYCLE[i % CYCLE.length] }));
}

export function TeacherDutyCharts({ myDuties }: { myDuties: PublishedAllocationRow[] }) {
  const byDept = useMemo(() => withColors(countBy(myDuties, (d) => String(d.dept ?? ""), 6)), [myDuties]);

  const byRoom = useMemo(() => {
    const cap = new Map<string, number>();
    for (const d of myDuties) {
      const k = d.room_name || "—";
      if (!cap.has(k) && d.room_capacity != null) cap.set(k, num(d.room_capacity));
    }
    return countBy(myDuties, (d) => String(d.room_name ?? ""), 8).map((r) => ({
      ...r,
      sub: cap.has(r.label) ? `cap ${cap.get(r.label)}` : undefined,
    }));
  }, [myDuties]);

  const seatsByCourse = useMemo(
    () => sumBy(myDuties, (d) => String(d.course_code ?? d.course_name ?? ""), (d) => num(d.expected_students), 8),
    [myDuties],
  );

  const loadOverTime = useMemo(() => bucketByDate(myDuties, (d) => String(d.exam_date ?? "")), [myDuties]);

  return (
    <div className="ov-grid">
      <ChartCard title="Duties by department" subtitle="Where your invigilation load sits">
        <DonutChart centerLabel="duties" data={byDept} />
      </ChartCard>

      <ChartCard title="Duties by room" subtitle="Rooms you invigilate (with capacity)">
        <HBarList data={byRoom} unit="duties" />
      </ChartCard>

      <ChartCard title="Seats by course" subtitle="Students you supervise per course">
        <HBarList data={seatsByCourse} color={VIZ.orange} unit="students" />
      </ChartCard>

      <ChartCard title="Duty load over time" subtitle="Your duties by exam date" wide>
        <AreaChart data={loadOverTime} />
      </ChartCard>
    </div>
  );
}
