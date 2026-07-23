import { useMemo } from "react";
import "@/styles/overview.css";
import { useProfileQuery } from "@/redux/features/auth/auth.api";
import { useGetAllocationReportsQuery } from "@/redux/features/allocations/allocations.api";
import { useGetExamsQuery, useGetRoomsQuery } from "@/redux/features/exam-room/examRoom.api";
import { useGetLeaveHistoryQuery } from "@/redux/features/leaves/leaves.api";
import { useGetDepartmentsQuery, useGetCoursesQuery } from "@/redux/features/foundations/foundations.api";
import { useGetActivityLogsQuery } from "@/redux/features/logs/logs.api";
import { AreaChart, ChartCard, DonutChart, HBarList, VIZ } from "@/components/overview/charts";

const arr = (x: unknown): Record<string, unknown>[] => {
  if (Array.isArray(x)) return x as Record<string, unknown>[];
  const d = (x as { data?: unknown } | undefined)?.data;
  return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmtShortDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const fmtTime = (v: unknown) => {
  const s = String(v ?? "");
  return s.length >= 16 ? s.replace("T", " ").slice(0, 16) : s.slice(0, 10) || "—";
};

export function AdminOverviewDashboard() {
  const { data: profile } = useProfileQuery();
  const { data: reports, isLoading: reportsLoading } = useGetAllocationReportsQuery();
  const { data: examsRaw } = useGetExamsQuery();
  const { data: roomsRaw, isLoading: roomsLoading } = useGetRoomsQuery();
  const { data: leavesRaw, isLoading: leavesLoading } = useGetLeaveHistoryQuery();
  const { data: deptsRaw, isLoading: deptsLoading } = useGetDepartmentsQuery();
  const { data: coursesRaw, isLoading: coursesLoading } = useGetCoursesQuery();
  const { data: activityRaw } = useGetActivityLogsQuery();

  const role = profile?.role === "SUPER_ADMIN" ? "Super Admin" : "Admin";
  const stats = (reports?.stats ?? {}) as Record<string, unknown>;

  const exams = useMemo(() => arr(examsRaw), [examsRaw]);
  const rooms = useMemo(() => arr(roomsRaw), [roomsRaw]);
  const leaves = useMemo(() => arr(leavesRaw), [leavesRaw]);
  const depts = useMemo(() => arr(deptsRaw), [deptsRaw]);
  const courses = useMemo(() => arr(coursesRaw), [coursesRaw]);
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

  const examsByDept = useMemo(() => {
    const m = new Map<string, number>();
    exams.forEach((e) => {
      const k = String(e.dept ?? "—") || "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [exams]);

  const workloadBars = useMemo(() => {
    return arr(reports?.workload)
      .map((w) => ({ name: String(w.name ?? ""), cur: num(w.current_allocations), limit: num(w.limit_value) }))
      .filter((w) => w.name)
      .sort((a, b) => b.cur - a.cur)
      .slice(0, 8)
      .map((w) => ({ label: w.name, value: w.cur, sub: w.limit ? `/ ${w.limit}` : undefined }));
  }, [reports]);

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bucket = new Map<string, number>();
    const add = (iso: string) => bucket.set(iso, (bucket.get(iso) ?? 0) + 1);
    exams.forEach((e) => {
      const d = String(e.exam_date ?? "").slice(0, 10);
      if (d && new Date(d) >= today) add(d);
    });
    if (bucket.size === 0) exams.forEach((e) => { const d = String(e.exam_date ?? "").slice(0, 10); if (d) add(d); });
    return [...bucket.keys()].sort().slice(0, 14).map((d) => ({ label: fmtShortDate(d), value: bucket.get(d) ?? 0 }));
  }, [exams]);

  const kpis = [
    { label: "Total exams", value: totalExams || exams.length, loading: reportsLoading },
    { label: "Published duties", value: published, loading: reportsLoading },
    { label: "Draft duties", value: draft, loading: reportsLoading },
    { label: "Teachers", value: totalTeachers, loading: reportsLoading },
    { label: "Rooms", value: rooms.length, loading: roomsLoading },
    { label: "Pending leaves", value: leaveCounts.PENDING, loading: leavesLoading },
    { label: "Departments", value: depts.length, loading: deptsLoading },
    { label: "Courses", value: courses.length, loading: coursesLoading },
  ];

  return (
    <div className="ov">
      <header className="ov__head">
        <h1 className="ov__title">{role} Overview</h1>
        <p className="ov__lead">
          Welcome back{profile?.name ? `, ${profile.name}` : ""}. A live snapshot of exams, invigilation duties, workload and leave.
        </p>
      </header>

      {/* KPI row */}
      <div className="ov-kpis">
        {kpis.map((k) => (
          <div className="ov-kpi" key={k.label}>
            <div className="ov-kpi__label">{k.label}</div>
            <div className="ov-kpi__value">{k.loading ? "—" : k.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="ov-grid">
        <ChartCard title="Invigilation duties" subtitle="Current routine — draft vs published">
          <DonutChart
            centerLabel="duties"
            data={[
              { label: "Published", value: published, color: VIZ.blue },
              { label: "Draft", value: draft, color: VIZ.orange },
            ]}
          />
        </ChartCard>

        <ChartCard title="Leave requests" subtitle="By status">
          <HBarList
            data={[
              { label: "Pending", value: leaveCounts.PENDING, color: VIZ.warning },
              { label: "Approved", value: leaveCounts.APPROVED, color: VIZ.good },
              { label: "Rejected", value: leaveCounts.REJECTED, color: VIZ.critical },
            ]}
          />
        </ChartCard>

        <ChartCard title="Exams by department" subtitle="Where the exam load sits">
          <HBarList data={examsByDept} unit="exams" />
        </ChartCard>

        <ChartCard title="Top invigilation workload" subtitle="Duties assigned per teacher (vs limit)">
          <HBarList data={workloadBars} unit="duties" />
        </ChartCard>

        <ChartCard title="Exam schedule" subtitle="Exams by date (upcoming first)" wide>
          <AreaChart data={upcoming} />
        </ChartCard>

        <ChartCard title="Recent activity" subtitle="Latest system events" wide>
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
