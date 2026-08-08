import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import "@/styles/overview.css";
import { Modal } from "@/components/ui/Modal";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import { VIZ } from "@/components/overview/charts";
import { num } from "@/utils/stats";
import { getErrorMessage } from "@/utils/getErrorMessage";
import {
  useCreateRoomMutation,
  useDeleteRoomMutation,
  useGetRoomsQuery,
  useUpdateRoomMutation,
} from "@/redux/features/exam-room/examRoom.api";
import { mapRooms } from "@/components/exam-room/examRoom.types";
import type { Room } from "@/types/examRoom";

const BUILDING_OPTIONS = ["Building A", "Building B"] as const;

export function RoomsPanel() {
  const { data: rowsRaw = [], isLoading, error } = useGetRoomsQuery({ limit: 100 });
  const rows = useMemo(() => mapRooms(rowsRaw), [rowsRaw]);

  const usable = useMemo(() => rows.filter((r) => !r.is_defect), [rows]);
  const defectCount = rows.length - usable.length;
  const totalCapacity = useMemo(() => usable.reduce((s, r) => s + num(r.capacity), 0), [usable]);

  const [createRoom, { isLoading: creating }] = useCreateRoomMutation();
  const [updateRoom, { isLoading: updating }] = useUpdateRoomMutation();
  const [deleteRoom, { isLoading: deleting }] = useDeleteRoomMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [name, setName] = useState("");
  const [building, setBuilding] = useState<string>(BUILDING_OPTIONS[0]);
  const [capacity, setCapacity] = useState<number>(20);
  const [isDefect, setIsDefect] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setBuilding(BUILDING_OPTIONS[0]);
    setCapacity(20);
    setIsDefect(false);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (r: Room) => {
    setEditing(r);
    setName(r.name);
    setBuilding(BUILDING_OPTIONS.includes(r.building as (typeof BUILDING_OPTIONS)[number]) ? r.building : BUILDING_OPTIONS[0]);
    setCapacity(r.capacity || 20);
    setIsDefect(Boolean(r.is_defect));
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    if (!name.trim() || !building.trim() || !Number.isFinite(Number(capacity)) || Number(capacity) <= 0) {
      setFormError("Name, building, and a valid capacity are required.");
      return;
    }
    try {
      const basePayload = { name: name.trim(), building: building.trim(), capacity: Number(capacity) };
      if (editing) {
        await updateRoom({ id: editing.id, data: { ...basePayload, is_defect: isDefect } }).unwrap();
      } else {
        await createRoom(basePayload).unwrap();
      }
      setOpen(false);
      toast.success(editing ? "Room updated." : "Room created.");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not save room.");
      setFormError(msg);
      toast.error(msg);
    }
  };

  const onDelete = async (r: Room) => {
    if (!window.confirm(`Delete room "${r.name}"?`)) return;
    try {
      await deleteRoom(r.id).unwrap();
      toast.success("Room deleted.");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not delete room."));
    }
  };

  return (
    <>
      <div className="foundations__toolbar">
        <div className="foundations__toolbar-left">
          <h2 className="foundations__h2" style={{ margin: 0 }}>
            Rooms
          </h2>
          <span className="foundations__muted" style={{ margin: 0 }}>
            Create and maintain exam rooms (capacity, building, defect status).
          </span>
        </div>
        <div className="foundations__toolbar-right">
          <button className="foundations__btn" type="button" onClick={openCreate}>
            + Add room
          </button>
        </div>
      </div>

      {isLoading ? <p className="foundations__muted">Loading…</p> : null}
      {error ? <p className="foundations__error">Could not load rooms.</p> : null}

      {rows.length > 0 ? (
        <>
          <div className="ov-kpis" style={{ marginBottom: 16 }}>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Total rooms</div>
              <div className="ov-kpi__value">{rows.length.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Usable</div>
              <div className="ov-kpi__value">{usable.length.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Defect</div>
              <div className="ov-kpi__value" style={{ color: VIZ.critical }}>{defectCount.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Total capacity</div>
              <div className="ov-kpi__value">{totalCapacity.toLocaleString()}</div>
            </div>
          </div>
        </>
      ) : null}

      <div className="foundations__table-wrap">
        <table className="foundations__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Building</th>
              <th>Capacity</th>
              <th>Status</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="foundations__empty">
                  No rooms yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td>{r.building || "—"}</td>
                  <td>{r.capacity || "—"}</td>
                  <td>{r.is_defect ? <span className="foundations__badge foundations__badge--danger">Defect</span> : "OK"}</td>
                  <td>
                    <div className="foundations__actions">
                      <button type="button" className="foundations__icon-btn" onClick={() => openEdit(r)} aria-label="Edit">
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        className="foundations__icon-btn foundations__icon-btn--danger"
                        disabled={deleting}
                        onClick={() => void onDelete(r)}
                        aria-label="Delete"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        title={editing ? "Edit room" : "Add room"}
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
            <span>Room name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. R-301" />
          </label>
          <label className="foundations__field">
            <span>Building</span>
            <select value={building} onChange={(e) => setBuilding(e.target.value)}>
              {BUILDING_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="foundations__field">
            <span>Capacity</span>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              min={1}
              step={1}
              placeholder="e.g. 40"
            />
          </label>
          {editing ? (
            <label className="foundations__field">
              <span>Status</span>
              <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input type="checkbox" checked={isDefect} onChange={(e) => setIsDefect(e.target.checked)} />
                <span className="foundations__muted">Mark as defect (excluded from allocation)</span>
              </label>
            </label>
          ) : null}
          {formError ? <div className="foundations__error">{formError}</div> : null}
        </div>
      </Modal>
    </>
  );
}

