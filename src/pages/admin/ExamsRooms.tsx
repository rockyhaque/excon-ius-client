import { useState } from "react";
import { RoomsPanel } from "@/components/exam-room/RoomsPanel";
import { ExamsPanel } from "@/components/exam-room/ExamsPanel";
import { ExamRoutinePanel } from "@/components/exam-room/ExamRoutinePanel";
import { Tabs } from "@/components/ui/Tabs";
import { PageCard } from "@/components/ui/PageCard";

export function ExamsRooms() {
  const [tab, setTab] = useState<"rooms" | "exams" | "routine">("rooms");
  return (
    <PageCard title="Exams & Rooms" lead="Manage rooms and exams, and generate the exam routine.">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "rooms", label: "Rooms" },
          { id: "exams", label: "Exams" },
          { id: "routine", label: "Routine" },
        ]}
      />
      {tab === "rooms" ? <RoomsPanel /> : null}
      {tab === "exams" ? <ExamsPanel /> : null}
      {tab === "routine" ? <ExamRoutinePanel /> : null}
    </PageCard>
  );
}
