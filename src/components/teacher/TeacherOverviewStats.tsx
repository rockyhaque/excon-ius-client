import "@/styles/teacher.css";
import "@/styles/overview.css";
import { useMemo } from "react";
import { hoursBetween, isUpcoming, leaveDays } from "@/utils/stats";
import type { PublishedAllocationRow } from "@/types/teacher";
import type { TeacherLeaveRow } from "@/types/teacher";

function fmtDate(v: unknown): string {
  const d = new Date(String(v ?? "").slice(0, 10));
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function hasCurrentOrUpcomingLeave(leaves: TeacherLeaveRow[]): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return leaves.some((l) => {
    if (String(l.status).toUpperCase() !== "APPROVED") return false;
    const end = new Date(String(l.end_date ?? "").slice(0, 10));
    return !isNaN(end.getTime()) && end >= today;
  });
}

export function TeacherOverviewStats({
  myDuties,
  leaves,
  isLoading,
}: {
  myDuties: PublishedAllocationRow[];
  leaves: TeacherLeaveRow[];
  isLoading: boolean;
}) {
  const stats = useMemo(() => {
    const upcoming = myDuties
      .filter((d) => isUpcoming(d.exam_date))
      .sort((a, b) => String(a.exam_date).localeCompare(String(b.exam_date)));
    const next = upcoming[0];
    const totalHours = myDuties.reduce((s, d) => s + hoursBetween(d.start_time, d.end_time), 0);
    const pendingLeaves = leaves.filter((l) => String(l.status).toUpperCase() === "PENDING").length;
    const approvedDays = leaves
      .filter((l) => String(l.status).toUpperCase() === "APPROVED")
      .reduce((s, l) => s + leaveDays(l.start_date, l.end_date), 0);

    const nextLabel = next
      ? `${fmtDate(next.exam_date)}${next.start_time ? ` · ${String(next.start_time).slice(0, 5)}` : ""}${
          next.course_code ? ` · ${next.course_code}` : ""
        }`
      : "—";

    return {
      upcoming: upcoming.length,
      nextLabel,
      totalHours,
      pendingLeaves,
      approvedDays,
    };
  }, [myDuties, leaves]);

  const status = hasCurrentOrUpcomingLeave(leaves) ? "On leave" : "Active";

  const dash = (v: string | number) => (isLoading ? "—" : v);

  const kpis: { label: string; value: string | number; small?: boolean }[] = [
    { label: "Upcoming duties", value: dash(stats.upcoming) },
    { label: "Next duty", value: dash(stats.nextLabel), small: true },
    { label: "Invigilation hours", value: dash(stats.totalHours ? stats.totalHours.toFixed(1) : 0) },
    { label: "Pending leaves", value: dash(stats.pendingLeaves) },
    { label: "Approved leave-days", value: dash(stats.approvedDays) },
    { label: "Status", value: dash(status), small: true },
  ];

  return (
    <div className="ov-kpis">
      {kpis.map((k) => (
        <div className="ov-kpi" key={k.label}>
          <div className="ov-kpi__label">{k.label}</div>
          <div className="ov-kpi__value" style={k.small ? { fontSize: "1.05rem" } : undefined}>
            {k.value}
          </div>
        </div>
      ))}
    </div>
  );
}
