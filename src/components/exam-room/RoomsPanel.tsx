import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import "@/styles/overview.css";
import { LoadingSpinner } from "@/components/ui/Loading";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
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

const CAMPUS_BUILDINGS = ["Building 1", "Building 2"] as const;

export function RoomsPanel() {
  const { data: rowsRaw = [], isLoading, error } = useGetRoomsQuery({ limit: 100 });
  const rows = useMemo(() => mapRooms(rowsRaw), [rowsRaw]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedLayout, setSelectedLayout] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "USABLE" | "DEFECT">("ALL");

  const getLayoutKey = (r: Room) => {
    const cols = r.columns_count || 4;
    const seats =
      Array.isArray(r.seats_per_column) && r.seats_per_column.length > 0
        ? r.seats_per_column.join(", ")
        : Array.from({ length: cols }, () => Math.floor((r.capacity || 40) / cols)).join(", ");
    return `${cols} cols (${seats})`;
  };

  const availableBuildings = useMemo(() => {
    const set = new Set<string>(CAMPUS_BUILDINGS);
    rows.forEach((r) => {
      if (r.building) set.add(r.building);
    });
    return Array.from(set).sort();
  }, [rows]);

  const availableLayouts = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      set.add(getLayoutKey(r));
    });
    return Array.from(set).sort();
  }, [rows]);

  const hasFilters = Boolean(searchQuery.trim() || selectedBuilding || selectedLayout || statusFilter !== "ALL");

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedBuilding("");
    setSelectedLayout("");
    setStatusFilter("ALL");
  };

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = String(r.name || "").toLowerCase().includes(q);
        const matchBldg = String(r.building || "").toLowerCase().includes(q);
        if (!matchName && !matchBldg) return false;
      }
      if (selectedBuilding && r.building !== selectedBuilding) {
        return false;
      }
      if (selectedLayout && getLayoutKey(r) !== selectedLayout) {
        return false;
      }
      if (statusFilter === "USABLE" && r.is_defect) {
        return false;
      }
      if (statusFilter === "DEFECT" && !r.is_defect) {
        return false;
      }
      return true;
    });
  }, [rows, searchQuery, selectedBuilding, selectedLayout, statusFilter]);

  const usable = useMemo(() => rows.filter((r) => !r.is_defect), [rows]);
  const defectCount = rows.length - usable.length;
  const totalCapacity = useMemo(() => usable.reduce((s, r) => s + num(r.capacity), 0), [usable]);

  const [createRoom, { isLoading: creating }] = useCreateRoomMutation();
  const [updateRoom, { isLoading: updating }] = useUpdateRoomMutation();
  const [deleteRoom, { isLoading: deleting }] = useDeleteRoomMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Room | null>(null);
  const [name, setName] = useState("");
  const [building, setBuilding] = useState<string>(CAMPUS_BUILDINGS[0]);
  const [capacity, setCapacity] = useState<number>(40);
  const [columnsCount, setColumnsCount] = useState<number>(4);
  const [seatsPerColumnStr, setSeatsPerColumnStr] = useState<string>("10, 10, 10, 10");
  const [isDefect, setIsDefect] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleColumnsCountChange = (newCount: number) => {
    const count = Math.max(1, Math.min(20, newCount));
    setColumnsCount(count);
    const perCol = Math.floor(capacity / count);
    const rem = capacity % count;
    const arr = Array.from({ length: count }, (_, i) => perCol + (i < rem ? 1 : 0));
    setSeatsPerColumnStr(arr.join(", "));
  };

  const handleSeatsStrChange = (str: string) => {
    setSeatsPerColumnStr(str);
    const nums = str
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length > 0) {
      setColumnsCount(nums.length);
      setCapacity(nums.reduce((a, b) => a + b, 0));
    }
  };

  const handleCapacityChange = (newCap: number) => {
    const cap = Math.max(1, newCap);
    setCapacity(cap);
    const perCol = Math.floor(cap / columnsCount);
    const rem = cap % columnsCount;
    const arr = Array.from({ length: columnsCount }, (_, i) => perCol + (i < rem ? 1 : 0));
    setSeatsPerColumnStr(arr.join(", "));
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setBuilding(CAMPUS_BUILDINGS[0]);
    setCapacity(40);
    setColumnsCount(4);
    setSeatsPerColumnStr("10, 10, 10, 10");
    setIsDefect(false);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (r: Room) => {
    setEditing(r);
    setName(r.name);
    setBuilding(r.building || CAMPUS_BUILDINGS[0]);
    setCapacity(r.capacity || 40);
    const cols = r.columns_count || 4;
    setColumnsCount(cols);
    const seatsStr = Array.isArray(r.seats_per_column) && r.seats_per_column.length > 0
      ? r.seats_per_column.join(", ")
      : Array.from({ length: cols }, () => Math.floor((r.capacity || 40) / cols)).join(", ");
    setSeatsPerColumnStr(seatsStr);
    setIsDefect(Boolean(r.is_defect));
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    const seats = seatsPerColumnStr
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (!name.trim() || !building.trim() || seats.length === 0) {
      setFormError("Room no., building, and valid seats per column are required.");
      return;
    }
    const calculatedCapacity = seats.reduce((a, b) => a + b, 0);

    try {
      const basePayload = {
        name: name.trim(),
        building: building.trim(),
        capacity: calculatedCapacity,
        columns_count: seats.length,
        seats_per_column: seats,
      };
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

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRoom(pendingDelete.id).unwrap();
      toast.success("Room deleted.");
      setPendingDelete(null);
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

      {isLoading ? <LoadingSpinner /> : null}
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

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
            }}
          >
            <div style={{ flex: "1 1 160px", minWidth: 140 }}>
              <input
                type="text"
                className="foundations__input"
                placeholder="Search room no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: 13, height: 34 }}
              />
            </div>

            <div style={{ flex: "1 1 160px", minWidth: 140 }}>
              <select
                className="foundations__select"
                value={selectedBuilding}
                onChange={(e) => setSelectedBuilding(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: 13, height: 34, background: "#fff" }}
              >
                <option value="">All Buildings ({availableBuildings.length})</option>
                {availableBuildings.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: "1 1 180px", minWidth: 160 }}>
              <select
                className="foundations__select"
                value={selectedLayout}
                onChange={(e) => setSelectedLayout(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: 13, height: 34, background: "#fff" }}
              >
                <option value="">All Layouts ({availableLayouts.length})</option>
                {availableLayouts.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: "0 1 130px", minWidth: 120 }}>
              <select
                className="foundations__select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{ width: "100%", padding: "6px 10px", fontSize: 13, height: 34, background: "#fff" }}
              >
                <option value="ALL">All Status</option>
                <option value="USABLE">Usable only</option>
                <option value="DEFECT">Defect only</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
              <span className="foundations__muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                Showing <strong>{filteredRows.length}</strong> of {rows.length}
              </span>
              {hasFilters ? (
                <button
                  type="button"
                  className="foundations__btn"
                  onClick={clearFilters}
                  style={{ fontSize: 12, padding: "4px 8px", height: 30 }}
                >
                  Reset
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      <div className="foundations__table-wrap" hidden={isLoading}>
        <table className="foundations__table">
          <thead>
            <tr>
              <th>Room No.</th>
              <th>Building</th>
              <th>Columns Layout</th>
              <th>Capacity</th>
              <th>Status</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="foundations__empty">
                  {hasFilters ? "No rooms match the selected filters." : "No rooms yet."}
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td>{r.building || "—"}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{r.columns_count || 4} cols</span>
                    <span className="foundations__muted" style={{ marginLeft: 6 }}>
                      ({Array.isArray(r.seats_per_column) && r.seats_per_column.length > 0 ? r.seats_per_column.join(", ") : "10, 10, 10, 10"})
                    </span>
                  </td>
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
                        onClick={() => setPendingDelete(r)}
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
            <span>Room No.</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 701" />
          </label>
          <label className="foundations__field">
            <span>Building</span>
            <select value={building} onChange={(e) => setBuilding(e.target.value)}>
              {availableBuildings.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <label className="foundations__field">
              <span>Columns count</span>
              <input
                type="number"
                value={columnsCount}
                onChange={(e) => handleColumnsCountChange(Number(e.target.value))}
                min={1}
                max={12}
                step={1}
              />
            </label>
            <label className="foundations__field">
              <span>Seats per column</span>
              <input
                value={seatsPerColumnStr}
                onChange={(e) => handleSeatsStrChange(e.target.value)}
                placeholder="e.g. 10, 10, 10, 10"
              />
            </label>
          </div>
          <span className="foundations__muted" style={{ fontSize: 12, marginTop: -4 }}>
            Comma-separated seat count per column. Total room capacity is calculated automatically.
          </span>
          <label className="foundations__field">
            <span>Total Capacity</span>
            <input
              type="number"
              value={capacity}
              onChange={(e) => handleCapacityChange(Number(e.target.value))}
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

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete room"
        message={
          pendingDelete
            ? `Delete room "${pendingDelete.name}"? This cannot be undone.`
            : ""
        }
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

