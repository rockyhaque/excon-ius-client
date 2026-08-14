import { DashboardLayout } from "@/layouts/DashboardLayout";

const items = [
  { to: "/super-admin", label: "Overview" },
  { to: "/super-admin/users", label: "All Users" },
  { to: "/super-admin/foundations", label: "Foundations" },
  { to: "/super-admin/exams-rooms", label: "Exams & Rooms" },
  { to: "/super-admin/allocations", label: "Allocations" },
  { to: "/super-admin/leaves", label: "Leave Requests" },
  { to: "/super-admin/assistant", label: "AI Assistant" },
  { to: "/super-admin/logs", label: "Logs" },
];

export function SuperAdminShell() {
  return <DashboardLayout title="Super Admin" items={items} />;
}

