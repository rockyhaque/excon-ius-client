import { NavLink, useNavigate } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/Loading";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRoleForRoute, role } from "@/constants/role";
import "@/styles/navbar.css";

export function Navbar() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="nav">
      <div className="container nav__inner">
        <div className="nav__brand">
          <span className="nav__logo">EXCON-IUS</span>
          <span className="nav__tag">Invigilation Management</span>
        </div>

        <nav className="nav__links" aria-label="Primary">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav__link active" : "nav__link")}>
            Home
          </NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/teacher" className={({ isActive }) => (isActive ? "nav__link active" : "nav__link")}>
                Teacher
              </NavLink>
              {normalizeRoleForRoute(user?.role) === role.superAdmin ? (
                <NavLink to="/super-admin" className={({ isActive }) => (isActive ? "nav__link active" : "nav__link")}>
                  Super Admin
                </NavLink>
              ) : (
                <NavLink to="/admin" className={({ isActive }) => (isActive ? "nav__link active" : "nav__link")}>
                  Admin
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="nav__right">
          {isLoading ? (
            <LoadingSpinner compact light size={18} />
          ) : isAuthenticated ? (
            <>
              <span className="nav__user" title={user?.email ?? ""}>
                {user?.name ?? "User"} ({user?.role})
              </span>
              <button className="btn btn--ghost" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => navigate("/login")}>
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

