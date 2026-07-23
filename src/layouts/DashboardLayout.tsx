import { NavLink, Outlet } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import "@/styles/dashboard.css";

type SidebarItem = { to: string; label: string };

export function DashboardLayout({ title, items }: { title: string; items: SidebarItem[] }) {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const onLogout = async () => {
    try {
      await logout();
    } catch {
      // Logout is best-effort — a network error shouldn't trap the user in the dashboard.
    }
    navigate("/login", { replace: true });
  };

  return (
    <div className="dashboard">
      <aside className="dashboard__sidebar" aria-label={`${title} sidebar`}>
        <div className="dashboard__title">{title}</div>
        <nav className="dashboard__nav">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end
              className={({ isActive }) => (isActive ? "dashboard__link active" : "dashboard__link")}
            >
              {it.label}
            </NavLink>
          ))}
        </nav>

        {isAuthenticated && (
          <div className="dashboard__sidebar-footer">
            <button type="button" className="dashboard__logout" onClick={() => void onLogout()}>
              Logout
            </button>
          </div>
        )}
      </aside>

      <section className="dashboard__content">
        <Outlet />
      </section>
    </div>
  );
}

