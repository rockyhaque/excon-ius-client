import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import "@/styles/overview.css";
import { Modal } from "@/components/ui/Modal";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import { DonutChart, ChartCard, VIZ } from "@/components/overview/charts";
import { getErrorMessage } from "@/utils/getErrorMessage";
import {
  useCreateAdminMutation,
  useDeactivateAdminMutation,
  useDeleteAdminMutation,
  useGetAllUsersQuery,
  useUpdateAdminMutation,
} from "@/redux/features/users/users.api";
import type { UserRecord } from "@/types/users";

type AdminRow = UserRecord & { role?: string; is_active?: boolean };

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

export function Admins() {
  const { data: allUsers = [], isLoading, error } = useGetAllUsersQuery({ role: "ADMIN", limit: 100 });
  const rows: AdminRow[] = useMemo(() => {
    const list = Array.isArray(allUsers) ? allUsers : [];
    return list.filter((u) => String(u.role || "").toUpperCase() === "ADMIN") as AdminRow[];
  }, [allUsers]);

  const activeCount = useMemo(() => rows.filter((u) => asBool((u as any).is_active ?? true)).length, [rows]);
  const inactiveCount = rows.length - activeCount;

  const [createAdmin, { isLoading: creating }] = useCreateAdminMutation();
  const [updateAdmin, { isLoading: updating }] = useUpdateAdminMutation();
  const [deleteAdmin, { isLoading: deleting }] = useDeleteAdminMutation();
  const [deactivateAdmin, { isLoading: deactivating }] = useDeactivateAdminMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setEmail("");
    setPassword("");
    setIsActive(true);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (u: AdminRow) => {
    setEditing(u);
    setName(safeStr(u.name));
    setEmail(safeStr(u.email));
    setPassword("");
    setIsActive(asBool((u as any).is_active ?? true));
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    if (!name.trim() || !email.trim()) {
      setFormError("Name and email are required.");
      return;
    }
    if (!editing && !password.trim()) {
      setFormError("Password is required to create an admin.");
      return;
    }
    try {
      if (editing) {
        await updateAdmin({
          id: editing.id,
          body: {
            name: name.trim(),
            email: email.trim(),
            is_active: isActive,
          },
        }).unwrap();
        toast.success("Admin updated.");
      } else {
        await createAdmin({ name: name.trim(), email: email.trim(), password: password.trim() }).unwrap();
        toast.success("Admin created.");
      }
      setOpen(false);
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not save admin.");
      setFormError(msg);
      toast.error(msg);
    }
  };

  const onDeactivate = async (u: AdminRow) => {
    if (!window.confirm(`Deactivate admin "${u.name ?? u.email ?? u.id}"?`)) return;
    try {
      await deactivateAdmin(u.id).unwrap();
      toast.success("Admin deactivated.");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not deactivate admin."));
    }
  };

  const onDelete = async (u: AdminRow) => {
    if (!window.confirm(`Delete admin "${u.name ?? u.email ?? u.id}"? This cannot be undone.`)) return;
    try {
      await deleteAdmin(u.id).unwrap();
      toast.success("Admin deleted.");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not delete admin."));
    }
  };

  return (
    <div className="foundations">
      <div className="card foundations__card">
        <div className="foundations__page-head">
          <div>
            <h1 style={{ margin: 0 }}>Admins</h1>
            <p className="foundations__lead">Create and manage departmental admins (SUPER_ADMIN only).</p>
          </div>
        </div>

        <div className="foundations__stats">
          <div className="foundations__stat">
            <div className="foundations__stat-label">Total admins</div>
            <div className="foundations__stat-value">{rows.length}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Active</div>
            <div className="foundations__stat-value">{activeCount}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Inactive</div>
            <div className="foundations__stat-value">{inactiveCount}</div>
          </div>
        </div>

        <div style={{ maxWidth: 360, margin: "0 0 16px" }}>
          <ChartCard title="Admin status" subtitle="Active vs inactive accounts">
            <DonutChart
              centerLabel="admins"
              data={[
                { label: "Active", value: activeCount, color: VIZ.good },
                { label: "Inactive", value: inactiveCount, color: VIZ.critical },
              ]}
            />
          </ChartCard>
        </div>

        <div className="foundations__toolbar">
          <div className="foundations__toolbar-left" />
          <div className="foundations__toolbar-right">
            <button className="foundations__btn" type="button" onClick={openCreate}>
              + Add admin
            </button>
          </div>
        </div>

        {isLoading ? <p className="foundations__muted">Loading…</p> : null}
        {error ? <p className="foundations__error">Could not load admins.</p> : null}

        <div className="foundations__table-wrap">
          <table className="foundations__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="foundations__empty">
                    No admins yet.
                  </td>
                </tr>
              ) : (
                rows.map((u) => {
                  const active = asBool((u as any).is_active ?? true);
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name ?? "—"}</strong>
                      </td>
                      <td>{u.email ?? "—"}</td>
                      <td>{active ? <span className="foundations__badge">Active</span> : <span className="foundations__badge foundations__badge--danger">Inactive</span>}</td>
                      <td>
                        <div className="foundations__actions">
                          <button type="button" className="foundations__icon-btn" onClick={() => openEdit(u)} aria-label="Edit">
                            <IconEdit />
                          </button>
                          <button
                            type="button"
                            className="foundations__btn foundations__btn--ghost"
                            disabled={deactivating || !active}
                            onClick={() => void onDeactivate(u)}
                          >
                            Deactivate
                          </button>
                          <button
                            type="button"
                            className="foundations__icon-btn foundations__icon-btn--danger"
                            disabled={deleting}
                            onClick={() => void onDelete(u)}
                            aria-label="Delete"
                          >
                            <IconTrash />
                          </button>
                        </div>
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
          title={editing ? "Edit admin" : "Add admin"}
          onClose={() => setOpen(false)}
          footer={
            <div className="foundations__modal-actions">
              <button className="foundations__btn foundations__btn--ghost" type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="foundations__btn" type="button" disabled={creating || updating} onClick={() => void submit()}>
                {creating || updating ? "Saving…" : "Save"}
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
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@ius.edu" />
            </label>
            {!editing ? (
              <label className="foundations__field">
                <span>Password</span>
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a password" />
              </label>
            ) : (
              <label className="foundations__field">
                <span>Status</span>
                <select value={String(isActive)} onChange={(e) => setIsActive(e.target.value === "true")}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
            )}
            {formError ? <div className="foundations__error">{formError}</div> : null}
          </div>
        </Modal>
      </div>
    </div>
  );
}

