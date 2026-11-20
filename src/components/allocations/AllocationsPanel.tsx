import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import "@/styles/overview.css";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { ChartCard, DonutChart, HBarList, VIZ } from "@/components/overview/charts";
import { countBy } from "@/utils/stats";
import {
  useEditAllocationMutation,
  useGetAiAllocationQuery,
  useGetAllocationReportsQuery,
  useGetAllocationConflictsQuery,
  useGetPublishedAllocationsQuery,
  useLazyGetTeacherInfoQuery,
  usePublishAllocationMutation,
  useClearDraftAllocationMutation,
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
import { AllocationTable } from "@/components/allocations/AllocationTable";
import { ReassignAllocationModal } from "@/components/allocations/ReassignAllocationModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  fmtDate,
  fmtTime,
  SummaryPill,
  toCount,
  type AiSummary,
  type AllocationTab,
  type RoomOption,
} from "@/components/allocations/allocations.helpers";

export function AllocationsPanel() {
  const [tab, setTab] = useState<AllocationTab>("draft");

  const draftQuery = useGetAiAllocationQuery(undefined, { skip: tab !== "draft" });
  const publishedQuery = useGetPublishedAllocationsQuery(undefined, { skip: tab !== "published" });
  const { data: reports } = useGetAllocationReportsQuery();
  const { data: roomsRaw = [] } = useGetRoomsQuery({ limit: 100 });

  const draftRows = useMemo(() => mapAllocations(draftQuery.data), [draftQuery.data]);
  const publishedRows = useMemo(() => mapAllocations(publishedQuery.data), [publishedQuery.data]);

  const { data: conflictsRaw = [] } = useGetAllocationConflictsQuery();
  const conflicts = useMemo(
    () =>
      (conflictsRaw as Array<Record<string, unknown> & { reasons?: string[] }>).map((c) => ({
        row: mapAllocations([c])[0],
        reasons: Array.isArray(c.reasons) ? c.reasons : [],
      })),
    [conflictsRaw],
  );

  const rooms = useMemo<RoomOption[]>(() => {
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
  const activeRows = tab === "draft" ? draftRows : publishedRows;

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
  const [clearDraft, { isLoading: clearing }] = useClearDraftAllocationMutation();
  const [editAllocation, { isLoading: saving }] = useEditAllocationMutation();
  const exportQuery = useGetPublishedAllocationsQuery();
  const exportRows = useMemo(() => (exportQuery.data ?? []) as PublishedAllocationRow[], [exportQuery.data]);
  const exportDepts = useMemo(() => deptsOf(exportRows), [exportRows]);
  const [exportDept, setExportDept] = useState("");
  const [searchTeachers, teacherSearch] = useLazyGetTeacherInfoQuery();

  const [editing, setEditing] = useState<AllocationRow | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [teacherLabel, setTeacherLabel] = useState("");
  const [roomId, setRoomId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"generate" | "publish" | "clear" | null>(null);

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

  const executeGenerate = async () => {
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

  const executePublish = async () => {
    try {
      const res = (await publish().unwrap()) as { message?: string };
      toast.success(res.message ?? "Allocation published.");
      setTab("published");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not publish allocation."));
    }
  };

  const executeClearDraft = async () => {
    try {
      const res = (await clearDraft().unwrap()) as { message?: string };
      toast.success(res.message ?? "Draft cleared.");
      setTab("draft");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not clear the draft."));
    }
  };

  const onConfirmAction = async () => {
    const act = confirmAction;
    setConfirmAction(null);
    if (act === "generate") await executeGenerate();
    else if (act === "publish") await executePublish();
    else if (act === "clear") await executeClearDraft();
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

        {conflicts.length > 0 ? (
          <div
            role="alert"
            style={{
              margin: "0 0 16px",
              border: `1px solid ${VIZ.critical}`,
              borderRadius: 10,
              background: "#fef2f2",
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <strong style={{ color: VIZ.critical }}>
                {conflicts.length} published dut{conflicts.length === 1 ? "y" : "ies"} need attention
              </strong>
              <span className="foundations__muted" style={{ margin: 0, fontSize: 13 }}>
                Something changed after publishing — review and reassign.
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {conflicts.map(({ row, reasons }) => (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    background: "#fff",
                    border: `1px solid ${VIZ.grid}`,
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {row.teacher_name}
                      {row.employee_id ? (
                        <span className="foundations__muted" style={{ margin: 0 }}> · {row.employee_id}</span>
                      ) : null}
                    </div>
                    <div className="foundations__muted" style={{ margin: 0, fontSize: 13 }}>
                      {row.course_code} · {fmtDate(row.exam_date)} · {fmtTime(row.start_time)}–{fmtTime(row.end_time)}
                      {row.room_name ? ` · ${row.room_name}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {reasons.map((rz) => (
                      <span
                        key={rz}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#fff",
                          background: VIZ.critical,
                          borderRadius: 999,
                          padding: "2px 9px",
                        }}
                      >
                        {rz}
                      </span>
                    ))}
                    <button
                      className="foundations__btn foundations__btn--ghost"
                      type="button"
                      style={{ padding: "6px 10px" }}
                      onClick={() => {
                        setTab("published");
                        openEdit(row);
                      }}
                    >
                      Reassign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
            <button
              className="foundations__btn foundations__btn--ghost"
              type="button"
              onClick={() => setConfirmAction("generate")}
              disabled={generating || publishing || clearing}
            >
              {generating ? "Generating…" : "Generate routine"}
            </button>
            <button
              className="foundations__btn foundations__btn--ghost"
              type="button"
              onClick={() => {
                if (draftRows.length === 0) return toast.info("No draft routine to clear.");
                setConfirmAction("clear");
              }}
              disabled={clearing || generating || draftRows.length === 0}
            >
              {clearing ? "Clearing…" : "Clear draft"}
            </button>
            <button
              className="foundations__btn"
              type="button"
              onClick={() => {
                if (draftRows.length === 0) return toast.info("No draft routine to publish. Generate one first.");
                setConfirmAction("publish");
              }}
              disabled={publishing || generating || draftRows.length === 0}
            >
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

      <ReassignAllocationModal
        editing={editing}
        saving={saving}
        teacherId={teacherId}
        teacherLabel={teacherLabel}
        roomId={roomId}
        searchTerm={searchTerm}
        formError={formError}
        rooms={rooms}
        teacherResults={teacherResults}
        teacherSearchFetching={teacherSearch.isFetching}
        onClose={closeEdit}
        onSubmit={() => void submitEdit()}
        onSearchTermChange={setSearchTerm}
        onSearchTeachers={() => void onSearchTeachers()}
        onTeacherIdChange={setTeacherId}
        onTeacherLabelChange={setTeacherLabel}
        onRoomIdChange={setRoomId}
      />

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={
          confirmAction === "generate"
            ? "Generate Draft Routine"
            : confirmAction === "publish"
            ? "Publish Routine"
            : "Clear Draft Routine"
        }
        message={
          confirmAction === "generate"
            ? "Generate a fresh DRAFT routine? This replaces any existing draft (published duties remain untouched)."
            : confirmAction === "publish"
            ? "Publish the draft routine? Assigned teachers will be notified by email."
            : "Clear the draft routine? All draft duties will be removed. Published duties are kept."
        }
        confirmLabel={
          confirmAction === "generate"
            ? "Generate"
            : confirmAction === "publish"
            ? "Publish"
            : "Clear Draft"
        }
        busy={generating || publishing || clearing}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void onConfirmAction()}
      />
    </div>
  );
}
