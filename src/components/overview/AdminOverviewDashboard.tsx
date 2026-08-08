import { useMemo } from "react";
import "@/styles/overview.css";
import { useProfileQuery } from "@/redux/features/auth/auth.api";
import { useGetAllocationReportsQuery, useGetPublishedAllocationsQuery } from "@/redux/features/allocations/allocations.api";
import { useGetExamsQuery, useGetRoomsQuery } from "@/redux/features/exam-room/examRoom.api";
import { useGetLeaveHistoryQuery, useFetchAvailabilityQuery } from "@/redux/features/leaves/leaves.api";
import { useGetDepartmentsQuery, useGetCoursesQuery } from "@/redux/features/foundations/foundations.api";
import { useGetAllUsersQuery } from "@/redux/features/users/users.api";
import { useGetActivityLogsQuery } from "@/redux/features/logs/logs.api";
import { AreaChart, ChartCard, DonutChart, HBarList, VIZ } from "@/components/overview/charts";
import { bucketByDate, bucketByMonth, countBy, sumBy } from "@/utils/stats";

/** Categorical palette for many-slice donuts (blue/orange first per the data-viz method). */
const PALETTE = [VIZ.blue, VIZ.orange, VIZ.good, VIZ.warning, VIZ.critical, VIZ.neutral];
const toSlices = (rows: { label: string; value: number }[]) =>
  rows.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));
const truthy = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";

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
  const isSuper = profile?.role === "SUPER_ADMIN";
  const { data: reports, isLoading: reportsLoading } = useGetAllocationReportsQuery();
  const { data: examsRaw } = useGetExamsQuery({ limit: 100 });
  const { data: roomsRaw, isLoading: roomsLoading } = useGetRoomsQuery({ limit: 100 });
  const { data: leavesRaw, isLoading: leavesLoading } = useGetLeaveHistoryQuery();
  const { data: deptsRaw, isLoading: deptsLoading } = useGetDepartmentsQuery();
  const { data: coursesRaw, isLoading: coursesLoading } = useGetCoursesQuery();
  const { data: publishedRaw } = useGetPublishedAllocationsQuery();
  const { data: availabilityRaw, isLoading: availLoading } = useFetchAvailabilityQuery();
  const { data: usersRaw } = useGetAllUsersQuery({ limit: 100 }, { skip: !isSuper });
  const { data: activityRaw } = useGetActivityLogsQuery();

  const role = isSuper ? "Super Admin" : "Admin";
  const stats = (reports?.stats ?? {}) as Record<string, unknown>;

  const exams = useMemo(() => arr(examsRaw), [examsRaw]);
  const rooms = useMemo(() => arr(roomsRaw), [roomsRaw]);
  const leaves = useMemo(() => arr(leavesRaw), [leavesRaw]);
  const depts = useMemo(() => arr(deptsRaw), [deptsRaw]);
  const courses = useMemo(() => arr(coursesRaw), [coursesRaw]);
  const publishedRows = useMemo(() => arr(publishedRaw), [publishedRaw]);
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
      .map((w) => ({ id: String(w.id ?? ""), name: String(w.name ?? ""), cur: num(w.current_allocations), limit: num(w.limit_value) }))
      .filter((w) => w.name)
      .sort((a, b) => b.cur - a.cur)
      .slice(0, 8)
      .map((w) => ({ id: w.id, label: w.name, value: w.cur, sub: w.limit ? `/ ${w.limit}` : undefined }));
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

  /* ── Rooms: utilization + seat capacity + capacity by building ───────── */
  const roomDefect = useMemo(() => rooms.filter((r) => truthy(r.is_defect)).length, [rooms]);
  const roomUsable = rooms.length - roomDefect;
  const usableRooms = useMemo(() => rooms.filter((r) => !truthy(r.is_defect)), [rooms]);
  // "Seats available" excludes out-of-service rooms (matches RoomsPanel).
  const seatCapacity = useMemo(() => usableRooms.reduce((s, r) => s + num(r.capacity), 0), [usableRooms]);
  const capacityByBuilding = useMemo(
    () => sumBy(usableRooms, (r) => String(r.building ?? "—"), (r) => num(r.capacity), 8),
    [usableRooms],
  );

  /* ── Allocation coverage — measured in EXAMS (distinct exam ids), not duty rows ───────── */
  const publishedExams = num(stats.published_exams);
  const allocatedExams = num(stats.allocated_exams);
  const draftOnlyExams = Math.max(0, allocatedExams - publishedExams);
  const unallocated = Math.max(0, totalExams - allocatedExams);
  const coveragePct = totalExams > 0 ? Math.round((allocatedExams / totalExams) * 100) : 0;

  /* ── Workload distribution vs limit (buckets) ────────────────────────── */
  const workloadBuckets = useMemo(() => {
    const wl = arr(reports?.workload).map((w) => ({ cur: num(w.current_allocations), limit: num(w.limit_value) }));
    let over = 0, near = 0, moderate = 0, idle = 0;
    for (const w of wl) {
      if (w.cur === 0) idle++;
      else if (w.limit > 0 && w.cur > w.limit) over++;
      else if (w.limit > 0 && w.cur / w.limit >= 0.8) near++;
      else moderate++;
    }
    return { over, near, moderate, idle };
  }, [reports]);
  const teachersOverLimit = workloadBuckets.over;

  /* ── Exams by status + courses per department ────────────────────────── */
  const examsByStatus = useMemo(
    () => toSlices(countBy(exams, (e) => String(e.status ?? "—").toUpperCase() || "—")),
    [exams],
  );
  const coursesByDept = useMemo(
    () => countBy(courses, (c) => String(c.dept_name ?? c.dept ?? "—"), 8),
    [courses],
  );

  /* ── Published duties over exam dates ────────────────────────────────── */
  const dutiesOverDates = useMemo(
    () => bucketByDate(publishedRows, (r) => String(r.exam_date ?? ""), 14),
    [publishedRows],
  );

  /* ── Teacher availability ────────────────────────────────────────────── */
  const availableCount = useMemo(() => availability.filter((a) => truthy(a.is_available)).length, [availability]);
  const unavailableCount = availability.length - availableCount;

  /* ── Super-admin-only: users by role / status / signups over time ────── */
  const usersByRole = useMemo(
    () => toSlices(countBy(users, (u) => String(u.role ?? "—").toUpperCase() || "—")),
    [users],
  );
  const activeUsers = useMemo(() => users.filter((u) => u.is_active !== false).length, [users]);
  const inactiveUsers = users.length - activeUsers;
  const newUsers = useMemo(() => bucketByMonth(users, (u) => String(u.created_at ?? "")), [users]);

  const kpis = [
    { label: "Total exams", value: totalExams || exams.length, loading: reportsLoading },
    { label: "Published duties", value: published, loading: reportsLoading },
    { label: "Draft duties", value: draft, loading: reportsLoading },
    { label: "Teachers", value: totalTeachers, loading: reportsLoading },
    { label: "Rooms", value: rooms.length, loading: roomsLoading },
    { label: "Pending leaves", value: leaveCounts.PENDING, loading: leavesLoading },
    { label: "Departments", value: depts.length, loading: deptsLoading },
    { label: "Courses", value: courses.length, loading: coursesLoading },
    { label: "Seat capacity", value: seatCapacity, loading: roomsLoading },
    { label: "Coverage %", value: coveragePct, loading: reportsLoading },
    { label: "Teachers over limit", value: teachersOverLimit, loading: reportsLoading },
    { label: "Available teachers", value: availableCount, loading: availLoading },
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

        <ChartCard title="Room utilization" subtitle="Usable vs out-of-service rooms">
          <DonutChart
            centerLabel="rooms"
            data={[
              { label: "Usable", value: roomUsable, color: VIZ.good },
              { label: "Defective", value: roomDefect, color: VIZ.critical },
            ]}
          />
        </ChartCard>

        <ChartCard title="Workload distribution" subtitle="Teachers grouped by duty load vs limit">
          <HBarList
            data={[
              { label: "Over limit", value: workloadBuckets.over, color: VIZ.critical },
              { label: "Near limit (≥80%)", value: workloadBuckets.near, color: VIZ.warning },
              { label: "Moderate (<80%)", value: workloadBuckets.moderate, color: VIZ.blue },
              { label: "No duties", value: workloadBuckets.idle, color: VIZ.neutral },
            ]}
            unit="teachers"
          />
        </ChartCard>

        <ChartCard title="Exams by status" subtitle="Lifecycle of the current routine">
          <DonutChart centerLabel="exams" data={examsByStatus} />
        </ChartCard>

        <ChartCard title="Courses per department" subtitle="Curriculum spread">
          <HBarList data={coursesByDept} unit="courses" />
        </ChartCard>

        <ChartCard title="Room capacity by building" subtitle="Total seats available per building">
          <HBarList data={capacityByBuilding} unit="seats" color={VIZ.orange} />
        </ChartCard>

        <ChartCard title="Teacher availability" subtitle="Available for invigilation right now">
          <DonutChart
            centerLabel="teachers"
            data={[
              { label: "Available", value: availableCount, color: VIZ.good },
              { label: "Unavailable", value: unavailableCount, color: VIZ.neutral },
            ]}
          />
        </ChartCard>

        <ChartCard title="Published duties over time" subtitle="Assigned invigilation duties by exam date">
          <AreaChart data={dutiesOverDates} color={VIZ.blue} />
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

        <ChartCard title="Exam schedule" subtitle="Exams by date (upcoming first)">
          <AreaChart data={upcoming} />
        </ChartCard>

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
