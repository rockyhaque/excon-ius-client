import "@/styles/teacher.css";
import type { TeacherProfile } from "@/types/teacher";

function fmt(v: string | null | undefined) {
  if (v == null || v === "") return "—";
  return String(v);
}

export function TeacherProfileCard({
  profile,
  isLoading,
  onLeave = false,
}: {
  profile: TeacherProfile | null;
  isLoading: boolean;
  onLeave?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="foundations">
        <div className="card foundations__card">
          <div className="foundations__page-head">
            <div>
              <h2>Profile</h2>
              <p className="foundations__muted">Loading profile…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile?.id) {
    return (
      <div className="foundations">
        <div className="card foundations__card">
          <div className="foundations__page-head">
            <div>
              <h2>Profile</h2>
              <p className="foundations__muted">Sign in to load your profile from the server.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="foundations">
      <div className="card foundations__card">
        <div className="foundations__page-head">
          <div>
            <h2>Your profile</h2>
            <p className="foundations__lead">Your staff and contact details.</p>
          </div>
        </div>
      <div className="teacher-profile">
        <div className="teacher-profile__field">
          <span className="teacher-profile__label">Name</span>
          <span className="teacher-profile__value">{fmt(profile.name)}</span>
        </div>
        <div className="teacher-profile__field">
          <span className="teacher-profile__label">Email</span>
          <span className="teacher-profile__value">{fmt(profile.email)}</span>
        </div>
        <div className="teacher-profile__field">
          <span className="teacher-profile__label">Employee ID</span>
          <span className="teacher-profile__value">{fmt(profile.employee_id)}</span>
        </div>
        <div className="teacher-profile__field">
          <span className="teacher-profile__label">Designation</span>
          <span className="teacher-profile__value">{fmt(profile.designation)}</span>
        </div>
        <div className="teacher-profile__field">
          <span className="teacher-profile__label">Phone</span>
          <span className="teacher-profile__value">{fmt(profile.phone)}</span>
        </div>
        <div className="teacher-profile__field">
          <span className="teacher-profile__label">Status</span>
          {onLeave ? (
            <span className="teacher-profile__badge teacher-profile__badge--off">On leave</span>
          ) : (
            <span className="teacher-profile__badge teacher-profile__badge--on">Active</span>
          )}
        </div>
        <div className="teacher-profile__field" style={{ gridColumn: "1 / -1" }}>
          <span className="teacher-profile__label">Present address</span>
          <span className="teacher-profile__value">{fmt(profile.present_address)}</span>
        </div>
        <div className="teacher-profile__field" style={{ gridColumn: "1 / -1" }}>
          <span className="teacher-profile__label">Permanent address</span>
          <span className="teacher-profile__value">{fmt(profile.permanent_address)}</span>
        </div>
      </div>
      </div>
    </div>
  );
}
