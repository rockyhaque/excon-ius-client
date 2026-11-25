import { useMemo } from "react";
import "@/styles/overview.css";
import { useProfileQuery } from "@/redux/features/auth/auth.api";
import { useGetAllocationReportsQuery } from "@/redux/features/allocations/allocations.api";
import { useGetRoomsQuery } from "@/redux/features/exam-room/examRoom.api";
import { useGetLeaveHistoryQuery, useFetchAvailabilityQuery } from "@/redux/features/leaves/leaves.api";
import { useGetAllUsersQuery } from "@/redux/features/users/users.api";
import { useGetActivityLogsQuery } from "@/redux/features/logs/logs.api";
import { AreaChart, ChartCard, DonutChart, HBarList, VIZ } from "@/components/overview/charts";
import { bucketByMonth, countBy } from "@/utils/stats";

/** Categorical palette for many-slice donuts (blue/orange first per the data-viz method). */
const PALETTE = [VIZ.blue, VIZ.orange, VIZ.good, VIZ.warning, VIZ.critical, VIZ.neutral];
const toSlices = (rows: { label: string; value: number }[]) =>
  rows.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));

const arr = (x: unknown): Record<string, unknown>[] => {
  if (Array.isArray(x)) return x as Record<string, unknown>[];
  const d = (x as { data?: unknown } | undefined)?.data;
  return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmtTime = (v: unknown) => {
  const s = String(v ?? "");
  return s.length >= 16 ? s.replace("T", " ").slice(0, 16) : s.slice(0, 10) || "—";
};

export function AdminOverviewDashboard() {
  const { data: profile } = useProfileQuery();
  const isSuper = profile?.role === "SUPER_ADMIN";
  const { data: reports, isLoading: reportsLoading } = useGetAllocationReportsQuery();
  const { data: roomsRaw, isLoading: roomsLoading } = useGetRoomsQuery({ limit: 100 });
  const { data: leavesRaw, isLoading: leavesLoading } = useGetLeaveHistoryQuery();
  const { data: availabilityRaw, isLoading: availLoading } = useFetchAvailabilityQuery();
  const { data: usersRaw } = useGetAllUsersQuery({ limit: 100 }, { skip: !isSuper });
  const { data: activityRaw } = useGetActivityLogsQuery();

  const role = isSuper ? "Super Admin" : "Admin";
  const stats = (reports?.stats ?? {}) as Record<string, unknown>;

  const rooms = useMemo(() => arr(roomsRaw), [roomsRaw]);
  const leaves = useMemo(() => arr(leavesRaw), [leavesRaw]);
  const availability = useMemo(() => arr(availabilityRaw), [availabilityRaw]);
  const users = useMemo(() => arr(usersRaw), [usersRaw]);
  const activity = useMemo(() => arr(activityRaw).slice(0, 8), [activityRaw]);

  const published = num(stats.published_count);
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

  const usersByRole = useMemo(
    () => toSlices(countBy(users, (u) => String(u.role ?? "—").toUpperCase() || "—")),
    [users],
  );
  const activeUsers = useMemo(() => users.filter((u) => u.is_active !== false).length, [users]);
  const inactiveUsers = users.length - activeUsers;
  const newUsers = useMemo(() => bucketByMonth(users, (u) => String(u.created_at ?? "")), [users]);

  const kpis = [
    { label: "Total exams", value: totalExams, loading: reportsLoading },
    { label: "Published duties", value: published, loading: reportsLoading },
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

      <div className="ov-kpis">
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

        {isSuper ? (
          <>
            <ChartCard title="Users by role" subtitle="System-wide account mix">
              <DonutChart centerLabel="users" data={usersByRole} />
            </ChartCard>

            <ChartCard title="Active vs inactive users" subtitle="Account status across the system">
              <DonutChart
                centerLabel="users"
                data={[
                  { label: "Active", value: activeUsers, color: VIZ.good },
                  { label: "Inactive", value: inactiveUsers, color: VIZ.critical },
                ]}
              />
            </ChartCard>

            <ChartCard title="New users over time" subtitle="Account sign-ups by month">
              <AreaChart data={newUsers} color={VIZ.orange} />
            </ChartCard>
          </>
        ) : null}

        <ChartCard title="Recent activity" subtitle="Latest system events">
          {activity.length === 0 ? (
            <div className="ov-chart__empty">No recent activity.</div>
          ) : (
            <ul className="ov-activity">
              {activity.map((a, i) => (
                <li key={String(a.id ?? i)}>
                  <span className="ov-activity__dot" />
                  <span className="ov-activity__action">{String(a.action ?? "—")}</span>
                  <span className="ov-activity__meta">
                    {String(a.user_name ?? "System")} · {fmtTime(a.created_at)}
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
