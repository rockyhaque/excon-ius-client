import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import "@/styles/home.css";

export function Home() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="home">
      <div className="home__hero">
        <h1>EXCON-IUS</h1>
        <p className="home__subtitle">Exam invigilation & allocation management for your institution.</p>

        {isAuthenticated ? (
          <div className="home__cta">
            <div className="home__badge">
              Signed in as <b>{user?.name}</b> ({user?.role})
            </div>
            <div className="home__buttons">
              <Link className="btn" to="/teacher">
                Teacher Dashboard
              </Link>
              <Link className="btn btn--ghost" to="/admin">
                Admin Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="home__cta">
            <Link className="btn" to="/login">
              Login
            </Link>
            <Link className="btn btn--ghost" to="/register">
              Create account
            </Link>
          </div>
        )}
      </div>

      <div className="home__grid">
        <div className="card">
          <h2>Allocations</h2>
          <p>AI-triggered allocation, publish flows, teacher views, and reporting.</p>
        </div>
        <div className="card">
          <h2>Leaves</h2>
          <p>Leave applications, approvals and history. Teachers on approved leave are marked on leave; everyone else stays active.</p>
        </div>
        <div className="card">
          <h2>Foundations</h2>
          <p>Departments, batches, sections and courses management.</p>
        </div>
      </div>
    </div>
  );
}

