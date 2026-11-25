import "@/styles/teacher.css";
import { useGetMyAllocationsQuery } from "@/redux/features/allocations/allocations.api";
import { useGetLeaveHistoryQuery } from "@/redux/features/leaves/leaves.api";
import { useTeacherProfile, useSkipTeacherApi } from "@/hooks/useTeacherProfile";
import { TeacherProfileCard } from "@/components/teacher/TeacherProfileCard";
import { TeacherOverviewStats } from "@/components/teacher/TeacherOverviewStats";
import { TeacherRulesCard } from "@/components/teacher/TeacherRulesCard";
import { TeacherExamsSnippet } from "@/components/teacher/TeacherExamsSnippet";
import type { PublishedAllocationRow } from "@/types/teacher";
import type { TeacherLeaveRow } from "@/types/teacher";

export function TeacherOverview() {
  const skipApi = useSkipTeacherApi();
  const { profile, isLoading, teacherId } = useTeacherProfile();

  const {
    data: myDuties = [],
    isLoading: isLoadingAllocations,
    error: allocationsError,
  } = useGetMyAllocationsQuery(undefined, { skip: skipApi });
  const {
    data: leaveHistory = [],
    isLoading: isLoadingLeaves,
    error: leavesError,
  } = useGetLeaveHistoryQuery(undefined, { skip: skipApi });

  const duties = (myDuties as PublishedAllocationRow[]).filter((a) => !teacherId || a.teacher_id === teacherId);
  const leaves = leaveHistory as TeacherLeaveRow[];

  return (
    <div className="teacher-adminlike">
      <div className="foundations">
        <div className="card foundations__card">
          <div className="foundations__page-head">
            <div>
              <h1>Teacher overview</h1>
              <p className="foundations__lead">Quick snapshot of your profile, leave requests, duties, and upcoming exams.</p>
            </div>
          </div>
        {(Boolean(allocationsError) || Boolean(leavesError)) && (
          <p className="foundations__error" style={{ marginTop: 12 }}>
            Some data could not be loaded. Please refresh and try again.
          </p>
        )}
        </div>
      </div>

      <TeacherOverviewStats
        myDuties={duties}
        leaves={leaves}
        isLoading={isLoading || isLoadingAllocations || isLoadingLeaves}
      />

      <TeacherProfileCard
        profile={profile}
        isLoading={isLoading}
        onLeave={leaves.some((l) => {
          if (String(l.status).toUpperCase() !== "APPROVED") return false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const end = new Date(String(l.end_date ?? "").slice(0, 10));
          return !isNaN(end.getTime()) && end >= today;
        })}
      />

      <TeacherRulesCard />

      <TeacherExamsSnippet
        duties={duties}
        isLoading={isLoadingAllocations}
        error={allocationsError}
        skipApi={skipApi}
      />
    </div>
  );
}
