import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import "@/styles/overview.css";
import { Modal } from "@/components/ui/Modal";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import { DonutChart, HBarList, ChartCard, VIZ } from "@/components/overview/charts";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { countBy } from "@/utils/stats";
import {
  useCreateAdminMutation,
  useDeleteAdminMutation,
  useDeleteTeacherMutation,
  useGetAllUsersQuery,
  useUpdateAdminMutation,
  useUpdateTeacherMutation,
} from "@/redux/features/users/users.api";
import type { UserRecord } from "@/types/users";

type UserRow = UserRecord & { role?: string; is_active?: boolean; employee_id?: string };

function safeStr(v: unknown) {
  if (v == null) return "";
  return String(v);
}

function asBool(v: unknown) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v === "true" || v === "1";
  return Boolean(v);
}

function roleOf(u: UserRow) {
  return String(u.role ?? "").toUpperCase();
}

/** Super admin can manage admins and teachers — not other super admins. */
function canManage(u: UserRow) {
  const r = roleOf(u);
  return r === "ADMIN" || r === "TEACHER";
}

export function Users() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");

  const queryArgs = useMemo(() => {
    const args: {
      limit: number;
      search?: string;
      role?: string;
      is_active?: boolean;
    } = { limit: 200 };
    if (search.trim()) args.search = search.trim();
    if (role) args.role = role;
    if (active) args.is_active = active === "true";
    return args;
  }, [active, role, search]);

  const { data: users = [], isLoading, error } = useGetAllUsersQuery(queryArgs);
  const rows = useMemo(() => (Array.isArray(users) ? (users as UserRow[]) : []), [users]);

  // Unfiltered snapshot so header stats stay stable regardless of table filters.
  const { data: allUsers = [] } = useGetAllUsersQuery({ limit: 200 });
  const stats = useMemo(() => {
    const list = Array.isArray(allUsers) ? (allUsers as UserRow[]) : [];
    const byRole = { SUPER_ADMIN: 0, ADMIN: 0, TEACHER: 0 } as Record<string, number>;
    let activeCount = 0;
    let available = 0;
    for (const u of list) {
      const r = roleOf(u);
      if (r in byRole) byRole[r]++;
      if (asBool(u.is_active ?? true)) activeCount++;
      if (asBool((u as { is_available?: unknown }).is_available)) available++;
    }
    return {
      total: list.length,
      byRole,
      active: activeCount,
      inactive: list.length - activeCount,
      available,
      onLeave: list.length - available,
    };
  }, [allUsers]);

  const roleSlices = useMemo(
    () =>
      countBy(Array.isArray(allUsers) ? allUsers : [], (u) => String(u.role ?? "—").toUpperCase() || "—").map(
        (d, i) => ({ ...d, color: [VIZ.blue, VIZ.orange, VIZ.good, VIZ.warning, VIZ.critical, VIZ.neutral][i % 6] }),
      ),
    [allUsers],
  );

  const [createAdmin, { isLoading: creating }] = useCreateAdminMutation();
  const [updateAdmin, { isLoading: updatingAdmin }] = useUpdateAdminMutation();
  const [updateTeacher, { isLoading: updatingTeacher }] = useUpdateTeacherMutation();
  const [deleteAdmin, { isLoading: deletingAdmin }] = useDeleteAdminMutation();
  const [deleteTeacher, { isLoading: deletingTeacher }] = useDeleteTeacherMutation();
  const saving = creating || updatingAdmin || updatingTeacher;
  const deleting = deletingAdmin || deletingTeacher;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create-admin" | "edit">("create-admin");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [employeeId, setEmployeeId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateAdmin = () => {
    setMode("create-admin");
    setEditing(null);
    setName("");
    setEmail("");
    setPassword("");
    setIsActive(true);
    setEmployeeId("");
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (u: UserRow) => {
    if (!canManage(u)) return;
    setMode("edit");
    setEditing(u);
    setName(safeStr(u.name));
    setEmail(safeStr(u.email));
    setPassword("");
    setIsActive(asBool(u.is_active ?? true));
    setEmployeeId(safeStr(u.employee_id));
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    if (!name.trim() || !email.trim()) {
      setFormError("Name and email are required.");
      return;
    }

    try {
      if (mode === "create-admin") {
        if (!password.trim()) {
          setFormError("Password is required to create an admin.");
          return;
        }
        await createAdmin({ name: name.trim(), email: email.trim(), password: password.trim() }).unwrap();
        toast.success("Admin created.");
      } else if (editing) {
        const r = roleOf(editing);
        if (r === "ADMIN") {
          await updateAdmin({
            id: editing.id,
            body: { name: name.trim(), email: email.trim(), is_active: isActive },
          }).unwrap();
          toast.success("Admin updated.");
        } else if (r === "TEACHER") {
          await updateTeacher({
            id: editing.id,
            body: {
              name: name.trim(),
              email: email.trim(),
              is_active: isActive,
              ...(employeeId.trim() ? { employee_id: employeeId.trim() } : {}),
            },
          }).unwrap();
          toast.success("Teacher updated.");
        }
      }
      setOpen(false);
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not save user.");
      setFormError(msg);
      toast.error(msg);
    }
  };

  const askDelete = (u: UserRow) => {
    if (!canManage(u)) return;
    setPendingDelete(u);
  };

  const confirmDelete = async () => {
    const u = pendingDelete;
    if (!u) return;
    const r = roleOf(u);
    if (r !== "ADMIN" && r !== "TEACHER") return;
    const label = r === "ADMIN" ? "admin" : "teacher";
    try {
      if (r === "ADMIN") await deleteAdmin(u.id).unwrap();
      else await deleteTeacher(u.id).unwrap();
      toast.success(`${r === "ADMIN" ? "Admin" : "Teacher"} deleted.`);
      setPendingDelete(null);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, `Could not delete ${label}.`));
    }
  };

  const editingRole = editing ? roleOf(editing) : "";
  const deleteRole = pendingDelete ? roleOf(pendingDelete) : "";
  const deleteLabel = deleteRole === "TEACHER" ? "teacher" : "admin";
  const modalTitle =
    mode === "create-admin" ? "Add admin" : editingRole === "TEACHER" ? "Edit teacher" : "Edit admin";

  return (
    <div className="foundations">
      <div className="card foundations__card">
        <div className="foundations__page-head">
          <div>
            <h1 style={{ margin: 0 }}>All Users</h1>
            <p className="foundations__lead">
              Manage admins and teachers — activate, deactivate, edit, or delete (SUPER_ADMIN only).
            </p>
          </div>
        </div>

        <div className="foundations__stats">
          <div className="foundations__stat">
            <div className="foundations__stat-label">Total users</div>
            <div className="foundations__stat-value">{stats.total}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Super admins</div>
            <div className="foundations__stat-value">{stats.byRole.SUPER_ADMIN}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Admins</div>
            <div className="foundations__stat-value">{stats.byRole.ADMIN}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Teachers</div>
            <div className="foundations__stat-value">{stats.byRole.TEACHER}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Active</div>
            <div className="foundations__stat-value">{stats.active}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Inactive</div>
            <div className="foundations__stat-value">{stats.inactive}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Available</div>
            <div className="foundations__stat-value">{stats.available}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">On leave</div>
            <div className="foundations__stat-value">{stats.onLeave}</div>
          </div>
        </div>

        <div
          style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", margin: "0 0 16px" }}
        >
          <ChartCard title="Users by role" subtitle="System-wide account mix">
            <DonutChart centerLabel="users" data={roleSlices} />
          </ChartCard>
          <ChartCard title="Account status" subtitle="Active vs inactive users">
            <HBarList
              data={[
                { label: "Active", value: stats.active, color: VIZ.good },
                { label: "Inactive", value: stats.inactive, color: VIZ.critical },
              ]}
              unit="users"
            />
          </ChartCard>
        </div>

        <div className="foundations__toolbar">
          <div className="foundations__toolbar-left">
            <input
              className="foundations__filter-control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name / email…"
              aria-label="Search users"
            />
          </div>
          <div className="foundations__toolbar-right">
            <select
              className="foundations__filter-control"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="ADMIN">ADMIN</option>
              <option value="TEACHER">TEACHER</option>
            </select>
            <select
              className="foundations__filter-control"
              value={active}
              onChange={(e) => setActive(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <button className="foundations__btn" type="button" onClick={openCreateAdmin}>
              + Add admin
            </button>
          </div>
        </div>

        {isLoading ? <p className="foundations__muted">Loading…</p> : null}
        {error ? <p className="foundations__error">Could not load users.</p> : null}

        <div className="foundations__table-wrap">
          <table className="foundations__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="foundations__empty">
                    No users found.
                  </td>
                </tr>
              ) : (
                rows.map((u) => {
                  const isActiveRow = asBool(u.is_active ?? true);
                  const manageable = canManage(u);
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{safeStr(u.name) || "—"}</strong>
                      </td>
                      <td>{safeStr(u.email) || "—"}</td>
                      <td>{safeStr(u.role) || "—"}</td>
                      <td>
                        {isActiveRow ? (
                          <span className="foundations__badge">Active</span>
                        ) : (
                          <span className="foundations__badge foundations__badge--danger">Inactive</span>
                        )}
                      </td>
                      <td>
                        {manageable ? (
                          <div className="foundations__actions">
                            <button
                              type="button"
                              className="foundations__icon-btn"
                              onClick={() => openEdit(u)}
                              aria-label="Edit"
                            >
                              <IconEdit />
                            </button>
                            <button
                              type="button"
                              className="foundations__icon-btn foundations__icon-btn--danger"
                              disabled={deleting}
                              onClick={() => askDelete(u)}
                              aria-label="Delete"
                            >
                              <IconTrash />
                            </button>
                          </div>
                        ) : (
                          <span className="foundations__muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Modal
          open={open}
          title={modalTitle}
          onClose={() => setOpen(false)}
          footer={
            <div className="foundations__modal-actions">
              <button className="foundations__btn foundations__btn--ghost" type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="foundations__btn" type="button" disabled={saving} onClick={() => void submit()}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          }
        >
          <div className="foundations__form">
            <label className="foundations__field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" />
            </label>
            <label className="foundations__field">
              <span>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@ius.edu" />
            </label>
            {mode === "create-admin" ? (
              <label className="foundations__field">
                <span>Password</span>
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a password" />
              </label>
            ) : (
              <>
                {editingRole === "TEACHER" ? (
                  <label className="foundations__field">
                    <span>Employee ID</span>
                    <input
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                ) : null}
                <label className="foundations__field">
                  <span>Status</span>
                  <select value={String(isActive)} onChange={(e) => setIsActive(e.target.value === "true")}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
              </>
            )}
            {formError ? <div className="foundations__error">{formError}</div> : null}
          </div>
        </Modal>

        <ConfirmModal
          open={Boolean(pendingDelete)}
          title={`Delete ${deleteLabel}`}
          message={`Delete ${deleteLabel} "${pendingDelete?.name ?? pendingDelete?.email ?? pendingDelete?.id ?? ""}"? This cannot be undone.`}
          busy={deleting}
          onClose={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      </div>
    </div>
  );
}
