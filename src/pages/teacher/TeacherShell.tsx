import { DashboardLayout } from "@/layouts/DashboardLayout";

const items = [
  { to: "/teacher", label: "Overview" },
  { to: "/teacher/schedule", label: "Exam Schedule" },
  { to: "/teacher/availability", label: "Availability" },
  { to: "/teacher/leaves", label: "Leaves" },
  { to: "/teacher/allocation", label: "My Allocation" },
  { to: "/teacher/assistant", label: "AI Assistant" },
];

export function TeacherShell() {
  return <DashboardLayout title="Teacher" items={items} />;
}

