import type { ComponentType } from "react";
import { Navigate } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/Loading";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRoleForRoute } from "@/constants/role";

export const withAuth = (Component: ComponentType, requiredRole?: string | string[]) => {
  return function AuthWrapper() {
    const { user, isLoading } = useAuth();

    if (!isLoading && !user?.email) {
      return <Navigate to="/login" replace />;
    }

    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : requiredRole ? [requiredRole] : null;
    const userRole = normalizeRoleForRoute(user?.role);
    // After login, there can be a short moment where user exists but role is not hydrated yet.
    // In that case, wait instead of flashing Unauthorized.
    if (allowedRoles && !isLoading && user?.email && userRole === "") {
      return <LoadingSpinner full />;
    }
    if (allowedRoles && !isLoading && !allowedRoles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }

    return <Component />;
  };
};

