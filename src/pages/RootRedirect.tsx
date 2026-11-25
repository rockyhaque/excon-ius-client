import { Navigate } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/Loading";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRoleForRoute, role } from "@/constants/role";

export function RootRedirect() {
  const { isLoading, user } = useAuth();

  if (isLoading) return <LoadingSpinner full />;

  if (!user?.email) return <Navigate to="/login" replace />;

  const r = normalizeRoleForRoute(user?.role);
  if (r === role.teacher) return <Navigate to="/teacher" replace />;
  if (r === role.superAdmin) return <Navigate to="/super-admin" replace />;

  return <Navigate to="/admin" replace />;
}

