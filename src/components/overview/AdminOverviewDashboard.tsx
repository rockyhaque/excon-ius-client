import { useMemo } from "react";
import "@/styles/overview.css";
import { useProfileQuery } from "@/redux/features/auth/auth.api";
import { useGetAllocationReportsQuery } from "@/redux/features/allocations/allocations.api";
import { useGetRoomsQuery } from "@/redux/features/exam-room/examRoom.api";
import { useGetLeaveHistoryQuery, useFetchAvailabilityQuery } from "@/redux/features/leaves/leaves.api";
import { useGetActivityLogsQuery } from "@/redux/features/logs/logs.api";
import { ChartCard, DonutChart, HBarList, VIZ } from "@/components/overview/charts";
import { buildRecentActivity } from "@/components/overview/activityFeed";

const arr = (x: unknown): Record<string, unknown>[] => {
  if (Array.isArray(x)) return x as Record<string, unknown>[];
  const d = (x as { data?: unknown } | undefined)?.data;
  return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function AdminOverviewDashboard() {
  const { data: profile } = useProfileQuery();
  const isSuper = profile?.role === "SUPER_ADMIN";
  const { data: reports, isLoading: reportsLoading } = useGetAllocationReportsQuery();
  const { data: roomsRaw, isLoading: roomsLoading } = useGetRoomsQuery({ limit: 100 });
  const { data: leavesRaw, isLoading: leavesLoading } = useGetLeaveHistoryQuery();
  const { data: availabilityRaw, isLoading: availLoading } = useFetchAvailabilityQuery();
  const { data: activityRaw, isLoading: activityLoading } = useGetActivityLogsQuery({ exclude: "ASSISTANT_QUERY" });

  const role = isSuper ? "Super Admin" : "Admin";
  const stats = (reports?.stats ?? {}) as Record<string, unknown>;

  const rooms = useMemo(() => arr(roomsRaw), [roomsRaw]);
  const leaves = useMemo(() => arr(leavesRaw), [leavesRaw]);
  const availability = useMemo(() => arr(availabilityRaw), [availabilityRaw]);

  const teacherMap = useMemo(() => {
    const m = new Map<string, string>();
    availability.forEach((t) => {
      if (t.id && t.name) m.set(String(t.id), String(t.name));
    });
    return m;
  }, [availability]);

  const roomMap = useMemo(() => {
    const m = new Map<string, string>();
    rooms.forEach((r) => {
      if (r.id && r.name) m.set(String(r.id), String(r.name));
    });
    return m;
  }, [rooms]);

  const activity = useMemo(
    () => buildRecentActivity(arr(activityRaw), leaves, teacherMap, roomMap, 8),
    [activityRaw, leaves, teacherMap, roomMap],
  );

  const draft = num(stats.draft_count);
  const totalExams = num(stats.total_exams);
  const totalTeachers = num(stats.total_teachers);

  const leaveCounts = useMemo(() => {
    const c = { PENDING: 0, APPROVED: 0, REJECTED: 0 } as Record<string, number>;
    leaves.forEach((l) => {
      const s = String(l.status ?? "").toUpperCase();
      if (s in c) c[s]++;
    });
    return c;
  }, [leaves]);

  const publishedExams = num(stats.published_exams);
  const allocatedExams = num(stats.allocated_exams);
  const draftOnlyExams = Math.max(0, allocatedExams - publishedExams);
  const unallocated = Math.max(0, totalExams - allocatedExams);
  const coveragePct = totalExams > 0 ? Math.round((allocatedExams / totalExams) * 100) : 0;

  const onLeaveCount = useMemo(() => availability.filter((a) => a.leave_id).length, [availability]);
  const activeTeacherCount = availability.length - onLeaveCount;

  const kpis = [
    { label: "Total exams", value: totalExams, loading: reportsLoading },
    { label: "Draft duties", value: draft, loading: reportsLoading },
    { label: "Teachers", value: totalTeachers, loading: reportsLoading },
    { label: "Rooms", value: rooms.length, loading: roomsLoading },
    { label: "Pending leaves", value: leaveCounts.PENDING, loading: leavesLoading },
    { label: "Coverage %", value: coveragePct, loading: reportsLoading },
    { label: "On leave today", value: onLeaveCount, loading: availLoading },
  ];

  return (
    <div className="ov">
      <header className="ov__head">
        <h1 className="ov__title">{role} Overview</h1>
        <p className="ov__lead">
          Welcome back{profile?.name ? `, ${profile.name}` : ""}. Exams, draft and published duties, coverage, and leave.
        </p>
      </header>

      <div className="ov-kpis ov-kpis--7">
        {kpis.map((k) => (
          <div className="ov-kpi" key={k.label}>
            <div className="ov-kpi__label">{k.label}</div>
            <div className="ov-kpi__value">{k.loading ? "—" : k.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="ov-grid">
        <ChartCard title="Leave requests" subtitle="By status">
          <HBarList
            data={[
              { label: "Pending", value: leaveCounts.PENDING, color: VIZ.warning },
              { label: "Approved", value: leaveCounts.APPROVED, color: VIZ.good },
              { label: "Rejected", value: leaveCounts.REJECTED, color: VIZ.critical },
            ]}
          />
        </ChartCard>

        <ChartCard title="Allocation coverage" subtitle={`${coveragePct}% of exams have duties assigned`}>
          <DonutChart
            centerLabel="exams"
            data={[
              { label: "Published", value: publishedExams, color: VIZ.blue },
              { label: "Draft only", value: draftOnlyExams, color: VIZ.orange },
              { label: "Unallocated", value: unallocated, color: VIZ.neutral },
            ]}
          />
        </ChartCard>

        <ChartCard title="Teachers" subtitle="On approved leave today, otherwise active">
          <DonutChart
            centerLabel="teachers"
            data={[
              { label: "Active", value: activeTeacherCount, color: VIZ.good },
              { label: "On leave", value: onLeaveCount, color: VIZ.warning },
            ]}
          />
        </ChartCard>

        <ChartCard title="Recent activity" subtitle="Latest routine, allocation, and leave events" wide>
          {activityLoading && activity.length === 0 ? (
            <div className="ov-chart__empty">Loading recent activity…</div>
          ) : activity.length === 0 ? (
            <div className="ov-chart__empty">No recent activity.</div>
          ) : (
            <ul className="ov-activity">
              {activity.map((a) => (
                <li key={a.id}>
                  <span className="ov-activity__dot" style={{ background: a.color }} />
                  <span className="ov-activity__action">{a.title}</span>
                  <span className="ov-activity__detail" title={a.detail}>{a.detail}</span>
                  <span className="ov-activity__meta">
                    {a.actor} · {a.time}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
