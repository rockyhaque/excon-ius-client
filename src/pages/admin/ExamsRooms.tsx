import { useState } from "react";
import { ExamRoutinePanel } from "@/components/exam-room/ExamRoutinePanel";
import { SeatingPlanPanel } from "@/components/exam-room/SeatingPlanPanel";
import { Tabs } from "@/components/ui/Tabs";
import { PageCard } from "@/components/ui/PageCard";

export function ExamsRooms() {
  const [tab, setTab] = useState<"routine" | "seating">("routine");
  return (
    <PageCard title="Exams & Timetables" lead="Manage exam schedules, classroom seating arrangements, and door notices.">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "routine", label: "Master Routine" },
          { id: "seating", label: "Seating Plan" },
        ]}
      />
      {tab === "routine" ? <ExamRoutinePanel onOpenSeating={() => setTab("seating")} /> : null}
      {tab === "seating" ? <SeatingPlanPanel onNavigateToRoutine={() => setTab("routine")} /> : null}
    </PageCard>
  );
}
