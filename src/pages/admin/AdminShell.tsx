import { DashboardLayout } from "@/layouts/DashboardLayout";

const items = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/foundations", label: "Foundations" },
  { to: "/admin/exams-rooms", label: "Exams & Rooms" },
  { to: "/admin/allocations", label: "Allocations" },
  { to: "/admin/leaves", label: "Leave Requests" },
  { to: "/admin/assistant", label: "AI Assistant" },
  { to: "/admin/logs", label: "Logs" },
];

export function AdminShell() {
  return <DashboardLayout title="Admin" items={items} />;
}

