import { createBrowserRouter, Navigate } from "react-router-dom";
import { Login } from "@/pages/auth/Login";
import { Register } from "@/pages/auth/Register";
import { Unauthorized } from "@/pages/Unauthorized";
import { withAuth } from "@/utils/withAuth";
import { role } from "@/constants/role";
import { RootRedirect } from "@/pages/RootRedirect";
import { AdminShell } from "@/pages/admin/AdminShell";
import { SuperAdminShell } from "@/pages/super-admin/SuperAdminShell";
import { TeacherShell } from "@/pages/teacher/TeacherShell";
import { AdminOverview } from "@/pages/admin/AdminOverview";
import { Foundations } from "@/pages/admin/Foundations";
import { ExamsRooms } from "@/pages/admin/ExamsRooms";
import { Allocations } from "@/pages/admin/Allocations";
import { LeaveRequests } from "@/pages/admin/LeaveRequests";
import { Logs } from "@/pages/admin/Logs";
import { Users } from "@/pages/super-admin/Users";
import { SuperAdminLogs } from "@/pages/super-admin/Logs";
import { TeacherOverview } from "@/pages/teacher/TeacherOverview";
import { Availability } from "@/pages/teacher/Availability";
import { Leaves } from "@/pages/teacher/Leaves";
import { MyAllocation } from "@/pages/teacher/MyAllocation";

export const router = createBrowserRouter([
  { path: "/", Component: RootRedirect },

  // Auth
  { path: "/login", Component: Login },
  { path: "/register", Component: Register },
  { path: "/unauthorized", Component: Unauthorized },

  // Admin dashboard
  {
    path: "/admin",
    Component: withAuth(AdminShell, role.admin),
    children: [
      { index: true, Component: AdminOverview },
      { path: "foundations", Component: Foundations },
      { path: "exams-rooms", Component: ExamsRooms },
      { path: "allocations", Component: Allocations },
      { path: "leaves", Component: LeaveRequests },
      { path: "logs", Component: Logs },
      { path: "*", element: <Navigate to="/admin" replace /> },
    ],
  },

  // Super admin dashboard (separate route)
  {
    path: "/super-admin",
    Component: withAuth(SuperAdminShell, role.superAdmin),
    children: [
      { index: true, Component: AdminOverview },
      { path: "users", Component: Users },
      { path: "admins", element: <Navigate to="/super-admin/users" replace /> },
      { path: "foundations", Component: Foundations },
      { path: "exams-rooms", Component: ExamsRooms },
      { path: "allocations", Component: Allocations },
      { path: "leaves", Component: LeaveRequests },
      { path: "logs", Component: SuperAdminLogs },
      { path: "*", element: <Navigate to="/super-admin" replace /> },
    ],
  },

  // Teacher dashboard
  {
    path: "/teacher",
    // SUPER_ADMIN can access everything (teacher + admin)
    Component: withAuth(TeacherShell, [role.teacher, role.superAdmin]),
    children: [
      { index: true, Component: TeacherOverview },
      { path: "availability", Component: Availability },
      { path: "leaves", Component: Leaves },
      { path: "allocation", Component: MyAllocation },
      { path: "*", element: <Navigate to="/teacher" replace /> },
    ],
  },

  { path: "*", element: <Navigate to="/login" replace /> },
]);

