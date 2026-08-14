import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import "@/styles/overview.css";
import { Modal } from "@/components/ui/Modal";
import { IconEdit } from "@/components/ui/Icons";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { ChartCard, DonutChart, HBarList, VIZ } from "@/components/overview/charts";
import { countBy } from "@/utils/stats";
import {
  useEditAllocationMutation,
  useGetAiAllocationQuery,
  useGetAllocationReportsQuery,
  useGetPublishedAllocationsQuery,
  useLazyGetTeacherInfoQuery,
  usePublishAllocationMutation,
  useTriggerAiAllocationMutation,
} from "@/redux/features/allocations/allocations.api";
import { useGetRoomsQuery } from "@/redux/features/exam-room/examRoom.api";
import { mapAllocations, mapWorkload, type AllocationRow } from "@/components/allocations/allocations.types";
import type { PublishedAllocationRow } from "@/types/teacher";
import {
  allocationCsv,
  buildDutySlipsHtml,
  buildHallPacketsHtml,
  deptsOf,
  downloadCsv,
  printDocument,
  stampName,
} from "@/utils/exports";

type AiSummary = {
  total_assigned: number;
  skipped_no_room: number;
  skipped_no_teacher: number;
  exams_fully_staffed: number;
  exams_partial: number;
  students_per_invigilator: number;
};

type Tab = "draft" | "published";
type RoomOption = { id: string; name: string; capacity: number | null; is_defect: boolean };

function fmtDate(v: string): string {
  return v ? v.slice(0, 10) : "—";
}
function fmtTime(v: string): string {
  return v ? v.slice(0, 5) : "—";
}
function toCount(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function SummaryPill({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        color: "#fff",
        background: color,
      }}
    >
      {value} <span style={{ fontWeight: 400, opacity: 0.92 }}>{label}</span>
    </span>
  );
}

function AllocationTable({
  rows,
  isLoading,
  isError,
  onEdit,
}: {
  rows: AllocationRow[];
  isLoading: boolean;
  isError: boolean;
  onEdit?: (r: AllocationRow) => void;
}) {
  const editable = Boolean(onEdit);
  const colCount = editable ? 8 : 7;

  return (
    <>
      {isLoading ? <p className="foundations__muted">Loading…</p> : null}
      {isError ? <p className="foundations__error">Could not load allocations.</p> : null}

      <div className="foundations__table-wrap">
        <table className="foundations__table">
          <thead>
            <tr>
              <th>Exam date</th>
              <th>Time</th>
              <th>Course</th>
              <th>Dept / Batch / Sec</th>
              <th>Room</th>
              <th>Teacher</th>
              <th>Status</th>
              {editable ? <th style={{ width: 90 }}>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="foundations__empty">
                  {isLoading
                    ? "Loading…"
                    : editable
                      ? "No draft routine yet. Click “Generate routine” to build one."
                      : "Nothing published yet."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.exam_date)}</td>
                  <td>
                    {fmtTime(r.start_time)} - {fmtTime(r.end_time)}
                  </td>
                  <td>
                    <strong>{r.course_code || "—"}</strong>
                    <div className="foundations__muted" style={{ margin: 0 }}>
                      {r.course_name}
                    </div>
                  </td>
                  <td>{[r.dept, r.batch, r.section].filter(Boolean).join(" / ") || "—"}</td>
                  <td>
                    {r.room_name || "—"}
                    {r.room_capacity != null ? (
                      <div className="foundations__muted" style={{ margin: 0 }}>
                        cap {r.room_capacity}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {r.teacher_name || "—"}
                    {r.employee_id ? (
                      <div className="foundations__muted" style={{ margin: 0 }}>
                        {r.employee_id}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span className="foundations__badge">{r.status || "—"}</span>
                  </td>
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className="foundations__icon-btn"
                        onClick={() => onEdit?.(r)}
                        aria-label="Reassign allocation"
                      >
                        <IconEdit />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function AllocationsPanel() {
  const [tab, setTab] = useState<Tab>("draft");

  const draftQuery = useGetAiAllocationQuery(undefined, { skip: tab !== "draft" });
  const publishedQuery = useGetPublishedAllocationsQuery(undefined, { skip: tab !== "published" });
  const { data: reports } = useGetAllocationReportsQuery();
  const { data: roomsRaw = [] } = useGetRoomsQuery({ limit: 100 });

  const draftRows = useMemo(() => mapAllocations(draftQuery.data), [draftQuery.data]);
  const publishedRows = useMemo(() => mapAllocations(publishedQuery.data), [publishedQuery.data]);

  const rooms = useMemo<RoomOption[]>(() => {
    // GET /exam-room/rooms is paginated → { data: [...] }; tolerate a bare array too.
    const list = Array.isArray(roomsRaw)
      ? roomsRaw
      : ((roomsRaw as unknown as { data?: unknown[] })?.data ?? []);
    return (list as Record<string, unknown>[]).map((r) => ({
      id: String(r.id ?? ""),
      name: String(r.name ?? ""),
      capacity: r.capacity == null ? null : toCount(r.capacity),
      is_defect: Boolean(r.is_defect),
    }));
  }, [roomsRaw]);

  const stats = reports?.stats as Record<string, unknown> | undefined;

  // Rows for whichever tab is active — drives the tab-scoped KPIs and "duties per room".
  const activeRows = tab === "draft" ? draftRows : publishedRows;

  // ── Derived stats for the charts ──────────────────────────────────
  // Coverage is measured in EXAMS (distinct exam ids), not duty-rows — a single exam can have both a
  // published and a fresh draft allocation row, so raw published_count+draft_count can exceed total_exams.
  const totalExams = toCount(stats?.total_exams);
  const publishedExams = toCount(stats?.published_exams);
  const allocatedExams = toCount(stats?.allocated_exams);
  const draftOnlyExams = Math.max(0, allocatedExams - publishedExams);
  const unassigned = Math.max(0, totalExams - allocatedExams);

  const teachersUtilized = useMemo(
    () => new Set(activeRows.map((r) => r.teacher_id).filter(Boolean)).size,
    [activeRows],
  );
  const overCapacityRooms = useMemo(
    () =>
      new Set(
        activeRows
          .filter((r) => r.room_capacity != null && r.expected_students != null && r.expected_students > r.room_capacity)
          .map((r) => r.room_id),
      ).size,
    [activeRows],
  );

  const workloadBars = useMemo(() => {
    return mapWorkload(reports?.workload)
      .filter((w) => w.name)
      .slice()
      .sort((a, b) => b.current_allocations - a.current_allocations)
      .slice(0, 12)
      .map((w) => {
        const cur = w.current_allocations;
        const lim = w.limit_value;
        const color =
          lim > 0 && cur >= lim ? VIZ.critical : lim > 0 && cur >= 0.8 * lim ? VIZ.warning : VIZ.blue;
        return { id: w.id, label: w.name, value: cur, sub: `/ ${lim}`, color };
      });
  }, [reports]);

  const dutiesPerRoom = useMemo(
    () => countBy(activeRows, (r) => r.room_name, 12),
    [activeRows],
  );

  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);

  const [triggerAi, { isLoading: generating }] = useTriggerAiAllocationMutation();
  const [publish, { isLoading: publishing }] = usePublishAllocationMutation();
  const [editAllocation, { isLoading: saving }] = useEditAllocationMutation();
  // Published duties for the export suite (kept subscribed regardless of the active tab).
  const exportQuery = useGetPublishedAllocationsQuery();
  const exportRows = useMemo(() => (exportQuery.data ?? []) as PublishedAllocationRow[], [exportQuery.data]);
  const exportDepts = useMemo(() => deptsOf(exportRows), [exportRows]);
  const [exportDept, setExportDept] = useState("");
  const [searchTeachers, teacherSearch] = useLazyGetTeacherInfoQuery();

  // ── Reassign (manual override) modal ──────────────────────────────
  const [editing, setEditing] = useState<AllocationRow | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [teacherLabel, setTeacherLabel] = useState("");
  const [roomId, setRoomId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const openEdit = (r: AllocationRow) => {
    setEditing(r);
    setTeacherId(r.teacher_id);
    setTeacherLabel(r.teacher_name || "");
    setRoomId(r.room_id);
    setSearchTerm("");
    setFormError(null);
  };

  const closeEdit = () => setEditing(null);

  const onSearchTeachers = async () => {
    const term = searchTerm.trim();
    if (!term) return;
    try {
      await searchTeachers(term).unwrap();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not search teachers."));
    }
  };

  const submitEdit = async () => {
    if (!editing) return;
    setFormError(null);
    if (!teacherId || !roomId) {
      setFormError("Both a teacher and a room are required.");
      return;
    }
    try {
      await editAllocation({ id: editing.id, body: { teacher_id: teacherId, room_id: roomId } }).unwrap();
      toast.success("Allocation reassigned.");
      closeEdit();
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not reassign allocation.");
      setFormError(msg);
      toast.error(msg);
    }
  };

  // ── Toolbar actions ───────────────────────────────────────────────
  const onGenerate = async () => {
    if (!window.confirm("Generate a fresh DRAFT routine? This replaces any existing draft (published duties are untouched).")) {
      return;
    }
    try {
      const res = (await triggerAi().unwrap()) as {
        message?: string;
        summary?: {
          total_assigned?: number; skipped_no_room?: number; skipped_no_teacher?: number;
          exams_fully_staffed?: number; exams_partial?: number; students_per_invigilator?: number;
        };
      };
      const s = res.summary;
      if (s) {
        const summary: AiSummary = {
          total_assigned: toCount(s.total_assigned),
          skipped_no_room: toCount(s.skipped_no_room),
          skipped_no_teacher: toCount(s.skipped_no_teacher),
          exams_fully_staffed: toCount(s.exams_fully_staffed),
          exams_partial: toCount(s.exams_partial),
          students_per_invigilator: toCount(s.students_per_invigilator),
        };
        setAiSummary(summary);
        const skipped = summary.skipped_no_room + summary.skipped_no_teacher;
        toast.success(`Draft routine generated — ${summary.total_assigned} duties assigned, ${skipped} exam(s) skipped.`);
      } else {
        setAiSummary(null);
        toast.success(res.message ?? "Draft routine generated.");
      }
      setTab("draft");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not generate routine."));
    }
  };

  const onPublish = async () => {
    if (draftRows.length === 0) {
      toast.info("No draft routine to publish. Generate one first.");
      return;
    }
    if (!window.confirm("Publish the draft routine? Assigned teachers will be notified by email.")) return;
    try {
      const res = (await publish().unwrap()) as { message?: string };
      toast.success(res.message ?? "Allocation published.");
      setTab("published");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not publish allocation."));
    }
  };

  const noRowsToast = () => toast.info("No published duties to export yet. Publish the routine first.");

  const onExportCsv = () => {
    if (exportRows.length === 0) return noRowsToast();
    const { header, rows } = allocationCsv(exportRows, { dept: exportDept });
    downloadCsv(stampName(exportDept ? `Invigilation_${exportDept}` : "Invigilation_Routine", "csv"), header, rows);
    toast.success("Invigilation routine exported.");
  };
  const onDutySlips = () => {
    if (exportRows.length === 0) return noRowsToast();
    if (!printDocument("Duty Slips", buildDutySlipsHtml(exportRows, { dept: exportDept })))
      toast.error("Pop-up blocked — allow pop-ups to export.");
  };
  const onHallPackets = () => {
    if (exportRows.length === 0) return noRowsToast();
    if (!printDocument("Hall Packets", buildHallPacketsHtml(exportRows, { dept: exportDept })))
      toast.error("Pop-up blocked — allow pop-ups to export.");
  };

  const teacherResults = teacherSearch.data ?? [];

  return (
    <div className="foundations">
      <div className="card foundations__card">
        <div className="foundations__page-head">
          <div>
            <h1 style={{ margin: 0 }}>Allocations</h1>
            <p className="foundations__lead">
              Generate the invigilation routine, review and adjust the draft, then publish to notify teachers.
            </p>
          </div>
        </div>

        <div className="foundations__stats">
          <div className="foundations__stat">
            <div className="foundations__stat-label">Draft duties</div>
            <div className="foundations__stat-value">{toCount(stats?.draft_count)}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Published duties</div>
            <div className="foundations__stat-value">{toCount(stats?.published_count)}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Total exams</div>
            <div className="foundations__stat-value">{toCount(stats?.total_exams)}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Total teachers</div>
            <div className="foundations__stat-value">{toCount(stats?.total_teachers)}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Teachers utilized ({tab})</div>
            <div className="foundations__stat-value">{teachersUtilized}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Over-capacity rooms ({tab})</div>
            <div className="foundations__stat-value" style={{ color: overCapacityRooms > 0 ? VIZ.critical : undefined }}>
              {overCapacityRooms}
            </div>
          </div>
        </div>

        {aiSummary ? (
          <div
            role="status"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              margin: "0 0 16px",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${VIZ.grid}`,
              background: "#f8fafc",
            }}
          >
            <strong style={{ marginRight: 4 }}>Last generation:</strong>
            <SummaryPill color={VIZ.good} label="duties assigned" value={aiSummary.total_assigned} />
            <SummaryPill color={VIZ.blue} label="halls fully staffed" value={aiSummary.exams_fully_staffed} />
            <SummaryPill color={VIZ.warning} label="halls short-staffed" value={aiSummary.exams_partial} />
            <SummaryPill color={VIZ.warning} label="skipped — no room" value={aiSummary.skipped_no_room} />
            <SummaryPill color={VIZ.critical} label="skipped — no teacher" value={aiSummary.skipped_no_teacher} />
            {aiSummary.students_per_invigilator ? (
              <span className="foundations__muted" style={{ margin: 0 }}>
                (~1 invigilator per {aiSummary.students_per_invigilator} students)
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="ov-grid" style={{ marginBottom: 16 }}>
          <ChartCard title="Duty coverage" subtitle="Exams by allocation state">
            <DonutChart
              centerLabel="exams"
              data={[
                { label: "Published", value: publishedExams, color: VIZ.good },
                { label: "Draft only", value: draftOnlyExams, color: VIZ.warning },
                { label: "Unassigned", value: unassigned, color: VIZ.neutral },
              ]}
            />
          </ChartCard>

          <ChartCard title="Invigilation workload" subtitle="Duties assigned per teacher (vs limit)">
            <HBarList data={workloadBars} unit="duties" />
          </ChartCard>

          <ChartCard title={`Duties per room (${tab})`} subtitle="Where the current routine sits">
            <HBarList data={dutiesPerRoom} unit="duties" color={VIZ.orange} />
          </ChartCard>
        </div>

        <div className="foundations__toolbar">
          <div className="foundations__toolbar-left">
            <span className="foundations__muted" style={{ margin: 0 }}>Exports for teachers &amp; staff</span>
          </div>
          <div className="foundations__toolbar-right">
            <select
              className="foundations__filter-control"
              value={exportDept}
              onChange={(e) => setExportDept(e.target.value)}
              aria-label="Department filter for exports"
            >
              <option value="">All departments</option>
              {exportDepts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button className="foundations__btn foundations__btn--ghost" type="button" onClick={onExportCsv} disabled={exportRows.length === 0}>
              Routine CSV
            </button>
            <button className="foundations__btn foundations__btn--ghost" type="button" onClick={onDutySlips} disabled={exportRows.length === 0}>
              Duty slips (PDF)
            </button>
            <button className="foundations__btn foundations__btn--ghost" type="button" onClick={onHallPackets} disabled={exportRows.length === 0}>
              Hall packets (PDF)
            </button>
          </div>
        </div>

        <div className="foundations__toolbar">
          <div className="foundations__toolbar-left">
            <span className="foundations__muted" style={{ margin: 0 }}>
              Draft allocations stay private until you publish them.
            </span>
          </div>
          <div className="foundations__toolbar-right">
            <button className="foundations__btn foundations__btn--ghost" type="button" onClick={() => void onGenerate()} disabled={generating}>
              {generating ? "Generating…" : "Generate routine"}
            </button>
            <button className="foundations__btn" type="button" onClick={() => void onPublish()} disabled={publishing || generating}>
              {publishing ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>

        <div className="foundations__tabs">
          <button
            type="button"
            className={`foundations__tab ${tab === "draft" ? "foundations__tab--active" : ""}`}
            onClick={() => setTab("draft")}
          >
            Draft (review)
          </button>
          <button
            type="button"
            className={`foundations__tab ${tab === "published" ? "foundations__tab--active" : ""}`}
            onClick={() => setTab("published")}
          >
            Published
          </button>
        </div>

        {tab === "draft" ? (
          <AllocationTable
            rows={draftRows}
            isLoading={draftQuery.isLoading}
            isError={Boolean(draftQuery.error)}
            onEdit={openEdit}
          />
        ) : (
          <AllocationTable
            rows={publishedRows}
            isLoading={publishedQuery.isLoading}
            isError={Boolean(publishedQuery.error)}
          />
        )}
      </div>

      <Modal
        open={Boolean(editing)}
        title="Reassign allocation"
        onClose={closeEdit}
        footer={
          <div className="foundations__modal-actions">
            <button className="foundations__btn foundations__btn--ghost" type="button" onClick={closeEdit}>
              Cancel
            </button>
            <button className="foundations__btn" type="button" disabled={saving} onClick={() => void submitEdit()}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        {editing ? (
          <div className="foundations__form">
            <div className="foundations__muted" style={{ marginTop: 0 }}>
              {editing.course_code} · {fmtDate(editing.exam_date)} · {fmtTime(editing.start_time)}-{fmtTime(editing.end_time)}
            </div>

            <label className="foundations__field">
              <span>Teacher</span>
              <div className="foundations__actions" style={{ width: "100%" }}>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void onSearchTeachers();
                    }
                  }}
                  placeholder="Search by name, email or employee ID"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="foundations__btn foundations__btn--ghost"
                  onClick={() => void onSearchTeachers()}
                  disabled={teacherSearch.isFetching || !searchTerm.trim()}
                >
                  {teacherSearch.isFetching ? "…" : "Search"}
                </button>
              </div>
            </label>

            {teacherResults.length > 0 ? (
              <label className="foundations__field">
                <span>Search results</span>
                <select
                  value={teacherId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setTeacherId(id);
                    const found = teacherResults.find((t) => t.id === id);
                    if (found) setTeacherLabel(found.name);
                  }}
                >
                  <option value="">Select a teacher…</option>
                  {teacherResults.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.employee_id ? ` (${t.employee_id})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="foundations__muted" style={{ marginTop: 0 }}>
              Selected teacher: <strong>{teacherLabel || "—"}</strong>
            </div>

            <label className="foundations__field">
              <span>Room</span>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Select a room…</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.is_defect}>
                    {r.name}
                    {r.capacity != null ? ` · cap ${r.capacity}` : ""}
                    {r.is_defect ? " (defect)" : ""}
                  </option>
                ))}
              </select>
            </label>

            {formError ? <div className="foundations__error">{formError}</div> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
