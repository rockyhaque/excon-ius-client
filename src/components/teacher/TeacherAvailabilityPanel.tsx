import "@/styles/teacher.css";
import "@/styles/overview.css";
import { useMemo } from "react";
import { useUpdateMyAvailabilityMutation } from "@/redux/features/leaves/leaves.api";
import { useGetPublishedAllocationsQuery } from "@/redux/features/allocations/allocations.api";
import { useTeacherProfile, useSkipTeacherApi } from "@/hooks/useTeacherProfile";
import { AreaChart, ChartCard } from "@/components/overview/charts";
import { bucketByDate, isUpcoming } from "@/utils/stats";
import type { PublishedAllocationRow } from "@/types/teacher";

export function TeacherAvailabilityPanel() {
  const skipApi = useSkipTeacherApi();
  const { profile, isLoading, refetch, teacherId } = useTeacherProfile();
  const [update, { isLoading: isSaving, error }] = useUpdateMyAvailabilityMutation();
  const { data: all = [] } = useGetPublishedAllocationsQuery(undefined, { skip: skipApi });

  const available = profile?.is_available === true;

  const upcomingDuties = useMemo(
    () =>
      (all as PublishedAllocationRow[]).filter(
        (a) => teacherId && a.teacher_id === teacherId && isUpcoming(a.exam_date),
      ),
    [all, teacherId],
  );

  const load = useMemo(() => bucketByDate(upcomingDuties, (d) => String(d.exam_date ?? "")), [upcomingDuties]);
  const hasUpcoming = upcomingDuties.length > 0;

  const onSet = async (is_available: boolean) => {
    await update({ is_available }).unwrap();
    await refetch();
  };

  if (skipApi) {
    return (
      <div className="foundations">
        <div className="card foundations__card">
          <div className="foundations__page-head">
            <div>
              <h2>Availability</h2>
              <p className="foundations__muted">Sign in to view and update your availability.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="foundations">
      <div className="card foundations__card">
        <div className="foundations__page-head">
          <div>
            <h2>Availability</h2>
            <p className="foundations__lead">Set whether you are available for invigilation scheduling.</p>
          </div>
        </div>

      {isLoading ? (
        <p className="foundations__muted">Loading…</p>
      ) : (
        <>
          <div className="ov-kpis" style={{ marginBottom: 14 }}>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Current status</div>
              <div className="ov-kpi__value" style={{ fontSize: "1.1rem" }}>
                {available ? "Available" : profile?.is_available === false ? "Not available" : "Unknown"}
              </div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Upcoming duties</div>
              <div className="ov-kpi__value">{upcomingDuties.length}</div>
            </div>
          </div>

          {hasUpcoming ? (
            <div style={{ marginBottom: 14 }}>
              <ChartCard title="Upcoming duty load" subtitle="Your scheduled duties by date">
                <AreaChart data={load} />
              </ChartCard>
            </div>
          ) : null}

          <div className="teacher-toggle">
            <button
              type="button"
              className="teacher-toggle__btn teacher-toggle__btn--yes"
              disabled={isSaving || available === true}
              onClick={() => void onSet(true)}
            >
              Set available
            </button>
            <button
              type="button"
              className="teacher-toggle__btn teacher-toggle__btn--no"
              disabled={isSaving || profile?.is_available === false}
              onClick={() => void onSet(false)}
            >
              Set unavailable
            </button>
          </div>

          {available && hasUpcoming ? (
            <p
              className="foundations__error"
              style={{ marginTop: 12, background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}
            >
              You have {upcomingDuties.length} upcoming {upcomingDuties.length === 1 ? "duty" : "duties"}. Marking yourself
              unavailable may require these to be re-allocated.
            </p>
          ) : null}

          {error != null && (
            <p className="foundations__error" style={{ marginTop: 12 }}>
              Could not update availability. Please try again.
            </p>
          )}
        </>
      )}
      </div>
    </div>
  );
}
