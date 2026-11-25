import "@/styles/teacher.css";
import { useGetMyAllocationsQuery } from "@/redux/features/allocations/allocations.api";
import { useSkipTeacherApi, useTeacherProfile } from "@/hooks/useTeacherProfile";
import { TeacherExamsSnippet } from "@/components/teacher/TeacherExamsSnippet";
import type { PublishedAllocationRow } from "@/types/teacher";

export function MyAllocation() {
  const skipApi = useSkipTeacherApi();
  const { teacherId } = useTeacherProfile();
  const { data: myDuties = [], isLoading, error } = useGetMyAllocationsQuery(undefined, { skip: skipApi });
  const duties = (myDuties as PublishedAllocationRow[]).filter((a) => !teacherId || a.teacher_id === teacherId);

  return (
    <div className="teacher-page">
      <TeacherExamsSnippet
        title="My allocation"
        lead="Your invigilation duties. The same list shows while the routine is a draft and after it is published."
        duties={duties}
        isLoading={isLoading}
        error={error}
        skipApi={skipApi}
      />
    </div>
  );
}
