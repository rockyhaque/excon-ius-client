import { useState } from "react";
import { RoomsPanel } from "@/components/exam-room/RoomsPanel";
import { ExamsPanel } from "@/components/exam-room/ExamsPanel";
import { ExamRoutinePanel } from "@/components/exam-room/ExamRoutinePanel";
import { SeatingPlanPanel } from "@/components/exam-room/SeatingPlanPanel";
import { Tabs } from "@/components/ui/Tabs";
import { PageCard } from "@/components/ui/PageCard";

export function ExamsRooms() {
  const [tab, setTab] = useState<"routine" | "seating" | "rooms" | "exams">("routine");
  return (
    <PageCard title="Exams & Timetables" lead="Manage exam schedules, classroom seating arrangements, and door notices.">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "routine", label: "Master Routine" },
          { id: "seating", label: "Seating & Door Notices" },
          { id: "rooms", label: "Rooms" },
          { id: "exams", label: "Exams" },
        ]}
      />
      {tab === "routine" ? <ExamRoutinePanel onOpenSeating={() => setTab("seating")} /> : null}
      {tab === "seating" ? <SeatingPlanPanel onNavigateToRoutine={() => setTab("routine")} /> : null}
      {tab === "rooms" ? <RoomsPanel /> : null}
      {tab === "exams" ? <ExamsPanel /> : null}
    </PageCard>
  );
}
