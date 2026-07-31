import "@/styles/teacher.css";
import { useGetPublishedAllocationsQuery } from "@/redux/features/allocations/allocations.api";
import { useGetLeaveHistoryQuery } from "@/redux/features/leaves/leaves.api";
import { useTeacherProfile, useSkipTeacherApi } from "@/hooks/useTeacherProfile";
import { TeacherProfileCard } from "@/components/teacher/TeacherProfileCard";
import { TeacherOverviewStats } from "@/components/teacher/TeacherOverviewStats";
import { TeacherDutyCharts } from "@/components/teacher/TeacherDutyCharts";
import { TeacherLeaveStats } from "@/components/teacher/TeacherLeaveStats";
import { TeacherRulesCard } from "@/components/teacher/TeacherRulesCard";
import { TeacherExamsSnippet } from "@/components/teacher/TeacherExamsSnippet";
import type { PublishedAllocationRow } from "@/types/teacher";
import type { TeacherLeaveRow } from "@/types/teacher";

export function TeacherOverview() {
  const skipApi = useSkipTeacherApi();
  const { profile, isLoading, teacherId } = useTeacherProfile();

  const {
    data: published = [],
    isLoading: isLoadingAllocations,
    error: allocationsError,
  } = useGetPublishedAllocationsQuery(undefined, { skip: skipApi });
  const {
    data: leaveHistory = [],
    isLoading: isLoadingLeaves,
    error: leavesError,
  } = useGetLeaveHistoryQuery(undefined, { skip: skipApi });

  const myDuties = (published as PublishedAllocationRow[]).filter((a) => teacherId && a.teacher_id === teacherId);
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
        myDuties={myDuties}
        leaves={leaves}
        isAvailable={profile?.is_available}
        isLoading={isLoading || isLoadingAllocations || isLoadingLeaves}
      />

      <TeacherDutyCharts myDuties={myDuties} />

      <TeacherLeaveStats leaves={leaves} />

      <TeacherProfileCard profile={profile} isLoading={isLoading} />

      <TeacherRulesCard />

      <TeacherExamsSnippet />
    </div>
  );
}
