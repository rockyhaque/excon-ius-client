import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "@/styles/overview.css";
import "@/styles/foundations.css";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { useGetSemestersQuery, useGetDepartmentsQuery, useGetBatchesQuery } from "@/redux/features/foundations/foundations.api";
import { mapBatches } from "@/components/foundations/foundations.types";
import {
  useGetExamsQuery,
  useGetRoomsQuery,
  useGenerateExamRoutineMutation,
  useUpdateExamMutation,
  useDeleteExamMutation,
  useDeleteExamRoutineMutation,
} from "@/redux/features/exam-room/examRoom.api";
import { deptsOf, downloadCsv, printOfficialRoutine, officialTableRows, stampName, timetableCsv } from "@/utils/exports";
import { RoutineBoard } from "@/components/exam-room/RoutineBoard";
import { EditExamModal, GenerateRoutineModal } from "@/components/exam-room/ExamRoutineModals";
import { OfficialRoutineView } from "@/components/exam-room/OfficialRoutineView";
import { RoomSeatingModal } from "@/components/exam-room/RoomSeatingModal";
import {
  arr,
  fmtBoardDay,
  s,
  type ExamRow,
  type ExamType,
  type Semester,
} from "@/components/exam-room/examRoutine.types";

interface ExamRoutinePanelProps {
  onOpenSeating?: () => void;
}

export function ExamRoutinePanel({ onOpenSeating }: ExamRoutinePanelProps = {}) {
  const { data: semRaw } = useGetSemestersQuery();
  const semesters = useMemo<Semester[]>(
    () => arr(semRaw).map((x) => ({ id: s(x.id), name: s(x.name), season: s(x.season), year: s(x.year) })),
    [semRaw],
  );

  const { data: deptRaw } = useGetDepartmentsQuery({ limit: 100 });
  const genDepartments = useMemo(
    () => arr(deptRaw).map((x) => ({ id: s(x.id), name: s(x.name), code: s(x.code) })).filter((d) => d.id && d.name),
    [deptRaw],
  );

  const { data: batchesRaw } = useGetBatchesQuery({ limit: 500 });
  const allBatches = useMemo(() => mapBatches(batchesRaw), [batchesRaw]);

  const [semesterId, setSemesterId] = useState("");
  const [viewType, setViewType] = useState<ExamType | "">("");
  const [deptFilter, setDeptFilter] = useState("");
  const [routineView, setRoutineView] = useState<"list" | "board">("list");
  const [seatingModalOpen, setSeatingModalOpen] = useState(false);

  useEffect(() => {
    if (!semesterId && semesters.length > 0) {
      const current = arr(semRaw).find((x) => x.is_current);
      setSemesterId(current ? s(current.id) : semesters[0]!.id);
    }
  }, [semesters, semRaw, semesterId]);

  const { data: examsRaw, isLoading, error } = useGetExamsQuery(
    semesterId
      ? { semester_id: semesterId, limit: 500, ...(viewType ? { exam_type: viewType } : {}) }
      : undefined,
    { skip: !semesterId },
  );

  const rows = useMemo<ExamRow[]>(
    () =>
      arr(examsRaw).map((e) => ({
        id: s(e.id),
        course_code: s(e.course_code),
        course_name: s(e.course_name),
        dept: s(e.dept),
        batch: s(e.batch),
        section: s(e.section),
        exam_date: s(e.exam_date).slice(0, 10),
        start_time: s(e.start_time),
        end_time: s(e.end_time),
        status: s(e.status),
        exam_type: s(e.exam_type),
        expected_students: e.expected_students == null ? null : Number(e.expected_students),
        room_id: s(e.room_id),
        room_name: s(e.room_name),
        room_building: s(e.room_building),
        room_capacity: e.room_capacity == null ? null : Number(e.room_capacity),
      })),
    [examsRaw],
  );

  const deptOptions = useMemo(() => deptsOf(rows), [rows]);
  const viewRows = useMemo(
    () => (deptFilter ? rows.filter((r) => r.dept === deptFilter) : rows),
    [rows, deptFilter],
  );

  const officialSheets = useMemo(() => {
    const names = deptFilter ? [deptFilter] : deptsOf(viewRows);
    return names
      .map((dept) => ({
        dept,
        rows: officialTableRows(viewRows.filter((r) => r.dept === dept)),
      }))
      .filter((sheet) => sheet.rows.length > 0);
  }, [viewRows, deptFilter]);

  const groups = useMemo(() => {
    const m = new Map<string, ExamRow[]>();
    viewRows.forEach((r) => {
      const g = m.get(r.exam_date) ?? [];
      g.push(r);
      m.set(r.exam_date, g);
    });
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([date, list]) =>
          [
            date,
            list.sort(
              (a, b) =>
                a.start_time.localeCompare(b.start_time) ||
                a.dept.localeCompare(b.dept) ||
                a.batch.localeCompare(b.batch),
            ),
          ] as const,
      );
  }, [viewRows]);

  const statusCounts = useMemo(() => {
    const c = { SCHEDULED: 0, RESCHEDULED: 0, PENDING: 0, CANCELLED: 0 } as Record<string, number>;
    viewRows.forEach((r) => {
      const st = (r.status || "").toUpperCase();
      if (st in c) c[st]++;
    });
    return c;
  }, [viewRows]);
  const deptsCovered = useMemo(() => new Set(viewRows.map((r) => r.dept).filter(Boolean)).size, [viewRows]);
  const roomsSeated = useMemo(() => viewRows.filter((r) => r.room_name).length, [viewRows]);

  const [generate, { isLoading: generating }] = useGenerateExamRoutineMutation();
  const [updateExam, { isLoading: saving }] = useUpdateExamMutation();
  const [deleteExam, { isLoading: deleting }] = useDeleteExamMutation();
  const [deleteRoutine, { isLoading: deletingRoutine }] = useDeleteExamRoutineMutation();

  const [genOpen, setGenOpen] = useState(false);
  const [genSem, setGenSem] = useState("");
  const [examType, setExamType] = useState<ExamType>("MIDTERM");
  const [genDept, setGenDept] = useState("");
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([{ start: "09:00", end: "12:00" }]);
  const [studentsPerSection, setStudentsPerSection] = useState(40);
  const [gapDays, setGapDays] = useState(1);

  const updateSlot = (i: number, field: "start" | "end", val: string) =>
    setSlots((prev) => prev.map((sl, idx) => (idx === i ? { ...sl, [field]: val } : sl)));
  const addSlot = () => setSlots((prev) => [...prev, { start: "14:00", end: "17:00" }]);
  const removeSlot = (i: number) => setSlots((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const [skipDays, setSkipDays] = useState<Set<number>>(new Set([5, 6])); // Fri, Sat by default
  const toggleSkipDay = (d: number) =>
    setSkipDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  const [replace, setReplace] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [pendingRegenWarning, setPendingRegenWarning] = useState<string | null>(null);

  const genBatches = useMemo(
    () => {
      const list = genDept ? allBatches.filter((b) => String(b.dept_id) === genDept) : allBatches;
      return [...list].sort((a, b) => (a.number ?? 0) - (b.number ?? 0) || String(a.dept_name).localeCompare(String(b.dept_name)));
    },
    [allBatches, genDept],
  );
  const runningBatches = useMemo(
    () => genBatches.filter((b) => b.status !== "COMPLETED"),
    [genBatches],
  );
  const genBatchIdsKey = runningBatches.map((b) => String(b.id)).join(",");

  useEffect(() => {
    setSelectedBatchIds(new Set(genBatchIdsKey ? genBatchIdsKey.split(",") : []));
  }, [genDept, genBatchIdsKey]);

  const toggleBatch = (id: string) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const setManyBatches = (ids: string[], on: boolean) =>
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const openGenerate = () => {
    const defaultSem =
      semesterId ||
      semesters.find((sm) => arr(semRaw).find((r) => r.id === sm.id && r.is_current))?.id ||
      semesters[0]?.id ||
      "";
    setGenSem(defaultSem);
    setExamType((viewType as ExamType) || "MIDTERM");
    setGenDept("");
    setStartDate("");
    setEndDate("");
    setSlots([{ start: "09:00", end: "12:00" }]);
    setStudentsPerSection(40);
    setGapDays(1);
    setSkipDays(new Set([5, 6]));
    setReplace(false);
    setGenError(null);
    setGenOpen(true);
  };

  const submitGenerate = async () => {
    setGenError(null);
    if (runningBatches.length === 0) {
      return setGenError("No running batches to schedule. Completed batches don't sit exams — add or resume batches in Foundations → Batches.");
    }
    if (selectedBatchIds.size === 0) {
      return setGenError("Select at least one batch.");
    }
    if (!startDate || !endDate) return setGenError("Date range is required.");
    if (endDate < startDate) return setGenError("End date must be on or after start date.");
    if (!Number.isFinite(studentsPerSection) || studentsPerSection < 1) {
      return setGenError("Students per section must be at least 1.");
    }
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    if (slots.length === 0 || slots.some((sl) => !sl.start || !sl.end)) {
      return setGenError("Every time slot needs a start and end time.");
    }
    if (slots.some((sl) => toMin(sl.end) <= toMin(sl.start))) {
      return setGenError("Each slot's end time must be after its start time.");
    }
    const sortedSlots = [...slots].sort((a, b) => toMin(a.start) - toMin(b.start));
    for (let i = 1; i < sortedSlots.length; i++) {
      if (toMin(sortedSlots[i].start) < toMin(sortedSlots[i - 1].end)) {
        return setGenError("Time slots must not overlap.");
      }
    }
    try {
      const sid = genSem || semesterId || semesters[0]?.id || "";
      if (!sid) return setGenError("Choose a semester. Create one in Foundations → Semesters if there are none.");
      const doGenerate = (confirmReplace: boolean) =>
        generate({
          semester_id: sid,
          exam_type: examType,
          start_date: startDate,
          end_date: endDate,
          slots: sortedSlots.map((sl) => ({ start_time: sl.start, end_time: sl.end })),
          skip_days: [...skipDays],
          replace,
          ...(confirmReplace ? { confirm_replace: true } : {}),
          ...(genDept ? { dept_id: genDept } : {}),
          batch_ids: [...selectedBatchIds],
          students_per_section: studentsPerSection,
          gap_days: gapDays,
        }).unwrap();

      let res;
      try {
        res = await doGenerate(false);
      } catch (e: unknown) {
        const status = (e as { status?: number })?.status;
        if (replace && status === 409) {
          const warning = getErrorMessage(e, "Regenerating will delete existing exams and their invigilation duties.");
          setPendingRegenWarning(warning);
          return;
        } else {
          throw e;
        }
      }

      setSemesterId(sid);
      setViewType(examType);
      setGenOpen(false);
      toast.success(res.message ?? "Exam routine generated.");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not generate routine.");
      setGenError(msg);
      toast.error(msg);
    }
  };

  const confirmRegenerate = async () => {
    setPendingRegenWarning(null);
    const sid = genSem || semesterId || semesters[0]?.id || "";
    if (!sid) return;
    const sortedSlots = [...slots].sort((a, b) => a.start.localeCompare(b.start));
    try {
      const res = await generate({
        semester_id: sid,
        exam_type: examType,
        start_date: startDate,
        end_date: endDate,
        slots: sortedSlots.map((sl) => ({ start_time: sl.start, end_time: sl.end })),
        skip_days: [...skipDays],
        replace: true,
        confirm_replace: true,
        ...(genDept ? { dept_id: genDept } : {}),
        batch_ids: [...selectedBatchIds],
        students_per_section: studentsPerSection,
        gap_days: gapDays,
      }).unwrap();

      setSemesterId(sid);
      setViewType(examType);
      setGenOpen(false);
      toast.success(res.message ?? "Exam routine generated.");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not generate routine.");
      setGenError(msg);
      toast.error(msg);
    }
  };

  const [editing, setEditing] = useState<ExamRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ExamRow | null>(null);
  const [eDate, setEDate] = useState("");
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");
  const [eStatus, setEStatus] = useState("SCHEDULED");
  const [eStudents, setEStudents] = useState<number | "">("");
  const [eRoomId, setERoomId] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const { data: roomsRaw } = useGetRoomsQuery({ limit: 200 });
  const roomOptions = useMemo(() => {
    const list = Array.isArray(roomsRaw) ? roomsRaw : ((roomsRaw as { data?: unknown[] } | undefined)?.data ?? []);
    return (list as Record<string, unknown>[])
      .filter((r) => !r.is_defect)
      .map((r) => ({ id: s(r.id), name: s(r.name), capacity: r.capacity == null ? null : Number(r.capacity) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [roomsRaw]);

  // NOTE (Claude): openEdit was orphaned by the merged-row list refactor — nothing
  // called it, which broke `tsc -b`. The Edit modal below is currently unreachable;
  // re-wire this onto an individual board card (RoutineBoard) to restore exam editing.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _openEditExam = (r: ExamRow) => {
    setEditing(r);
    setEDate(r.exam_date);
    setEStart(r.start_time.slice(0, 5));
    setEEnd(r.end_time.slice(0, 5));
    setEStatus(r.status || "SCHEDULED");
    setEStudents(r.expected_students ?? "");
    setERoomId(r.room_id || "");
    setEditError(null);
  };
  void _openEditExam;

  const submitEdit = async () => {
    if (!editing) return;
    setEditError(null);
    if (!eDate || !eStart || !eEnd) return setEditError("Date, start and end time are required.");
    if (eStudents !== "" && (!Number.isFinite(Number(eStudents)) || Number(eStudents) < 0)) {
      return setEditError("Expected students must be 0 or more.");
    }
    try {
      await updateExam({
        id: editing.id,
        data: {
          exam_date: eDate,
          start_time: eStart,
          end_time: eEnd,
          status: eStatus,
          expected_students: eStudents === "" ? null : Number(eStudents),
          room_id: eRoomId || null,
        },
      }).unwrap();
      setEditing(null);
      toast.success("Exam updated.");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Could not update exam.");
      setEditError(msg);
      toast.error(msg);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteExam(pendingDelete.id).unwrap();
      toast.success("Exam deleted.");
      setPendingDelete(null);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not delete exam."));
    }
  };

  const [pendingDeleteRoutine, setPendingDeleteRoutine] = useState(false);

  const routineDeleteLabel = viewType
    ? `${viewType === "MIDTERM" ? "Midterm" : "Final"} routine`
    : "full exam routine";
  const routineSemesterName = semesters.find((x) => x.id === semesterId)?.name || "this semester";

  const confirmDeleteRoutine = async () => {
    if (!semesterId) return;
    try {
      const res = await deleteRoutine({
        semester_id: semesterId,
        ...(viewType ? { exam_type: viewType } : {}),
        confirm: true,
      }).unwrap();
      setPendingDeleteRoutine(false);
      toast.success(res.message ?? "Routine deleted.");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not delete the routine."));
    }
  };

  const exportPdf = () => {
    if (viewRows.length === 0) return toast.error("No exams to export.");
    const sem = semesters.find((x) => x.id === semesterId);
    const ok = printOfficialRoutine(viewRows, {
      semester: sem?.name || "—",
      examType: viewType || viewRows[0]?.exam_type,
      ...(deptFilter ? { dept: deptFilter } : {}),
    });
    if (!ok) return toast.error("Pop-up blocked — allow pop-ups to export the PDF.");
  };

  const exportCsv = () => {
    if (viewRows.length === 0) return toast.error("No exams to export.");
    const { header, rows: body } = timetableCsv(viewRows);
    downloadCsv(stampName(deptFilter ? `Exam_Timetable_${deptFilter}` : "Exam_Timetable", "csv"), header, body);
    toast.success("Timetable exported.");
  };

  const handleMove = async (examId: string, date: string, st: string, et: string) => {
    const exam = rows.find((r) => r.id === examId);
    if (!exam) return;
    if (exam.exam_date === date && exam.start_time.slice(0, 5) === st) return;
    const targetCell = rows.filter(
      (r) => r.id !== examId && r.exam_date === date && r.start_time.slice(0, 5) === st && r.end_time.slice(0, 5) === et,
    );
    if (targetCell.some((r) => r.dept === exam.dept && r.batch === exam.batch && r.section === exam.section)) {
      return toast.error(`B${exam.batch}${exam.section ? "-" + exam.section : ""} already has an exam in this session.`);
    }
    if (exam.room_id && targetCell.some((r) => r.room_id === exam.room_id)) {
      return toast.error(`${exam.room_name || "That hall"} is already in use this session — reassign its hall first.`);
    }
    try {
      await updateExam({ id: examId, data: { exam_date: date, start_time: st, end_time: et } }).unwrap();
      toast.success(`Moved ${exam.course_code} to ${fmtBoardDay(date)}, ${st}.`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not move the exam."));
    }
  };

  return (
    <>
      <div className="foundations__toolbar">
        <div className="foundations__toolbar-left" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 className="foundations__h2" style={{ margin: 0 }}>
            Exam routine
          </h2>
          <div style={{ display: "inline-flex", gap: 4 }} role="group" aria-label="Routine view">
            <button
              type="button"
              className="foundations__btn foundations__btn--ghost"
              style={{ padding: "6px 12px", opacity: routineView === "list" ? 1 : 0.5 }}
              aria-pressed={routineView === "list"}
              onClick={() => setRoutineView("list")}
            >
              Official
            </button>
            <button
              type="button"
              className="foundations__btn foundations__btn--ghost"
              style={{ padding: "6px 12px", opacity: routineView === "board" ? 1 : 0.5 }}
              aria-pressed={routineView === "board"}
              onClick={() => setRoutineView("board")}
            >
              Board
            </button>
          </div>
        </div>
        <div className="foundations__toolbar-right">
          <select
            className="foundations__filter-control"
            value={semesterId}
            onChange={(e) => setSemesterId(e.target.value)}
            aria-label="Semester"
          >
            {semesters.length === 0 ? <option value="">No semesters</option> : null}
            {semesters.map((sm) => (
              <option key={sm.id} value={sm.id}>
                {sm.name}
              </option>
            ))}
          </select>
          <select
            className="foundations__filter-control"
            value={viewType}
            onChange={(e) => setViewType(e.target.value as ExamType | "")}
            aria-label="Exam type filter"
          >
            <option value="">All types</option>
            <option value="MIDTERM">Midterm</option>
            <option value="FINAL">Final</option>
          </select>
          <select
            className="foundations__filter-control"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            aria-label="Department filter"
          >
            <option value="">All departments</option>
            {deptOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button className="foundations__btn foundations__btn--ghost" type="button" onClick={exportPdf} disabled={viewRows.length === 0}>
            {deptFilter ? "Export this department" : "Export PDF (all departments)"}
          </button>
          <button className="foundations__btn foundations__btn--ghost" type="button" onClick={exportCsv} disabled={viewRows.length === 0}>
            Export CSV
          </button>
          <button
            className="foundations__btn foundations__btn--ghost"
            type="button"
            onClick={() => {
              if (onOpenSeating) {
                onOpenSeating();
              } else {
                setSeatingModalOpen(true);
              }
            }}
            disabled={rows.length === 0}
            style={{ fontWeight: 600, color: "#2563eb", borderColor: "#bfdbfe" }}
          >
            Seating Plan (Columns)
          </button>
          <button className="foundations__btn" type="button" onClick={openGenerate} disabled={generating}>
            {generating ? "Generating…" : "Generate routine"}
          </button>
          <button
            className="foundations__btn foundations__btn--danger"
            type="button"
            onClick={() => setPendingDeleteRoutine(true)}
            disabled={deletingRoutine || rows.length === 0}
          >
            {deletingRoutine ? "Deleting…" : "Delete routine"}
          </button>
        </div>
      </div>

      {isLoading ? <p className="foundations__muted">Loading…</p> : null}
      {error ? <p className="foundations__error">Could not load the routine.</p> : null}
      {!isLoading && semesterId && rows.length === 0 ? (
        <div className="foundations__empty" style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
          No exams for this filter yet. Click “Generate routine” (pick Midterm or Final).
        </div>
      ) : null}

      {!isLoading && rows.length > 0 && viewRows.length === 0 ? (
        <div className="foundations__empty" style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
          No exams for {deptFilter}. Choose another department.
        </div>
      ) : null}

      {viewRows.length > 0 ? (
        <>
          <div className="ov-kpis" style={{ marginBottom: 16 }}>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Total exams</div>
              <div className="ov-kpi__value">{viewRows.length.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Exam days</div>
              <div className="ov-kpi__value">{groups.length.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Departments</div>
              <div className="ov-kpi__value">{deptsCovered.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Rooms seated</div>
              <div className="ov-kpi__value">{roomsSeated.toLocaleString()}</div>
            </div>
            <div className="ov-kpi">
              <div className="ov-kpi__label">Cancelled / Rescheduled</div>
              <div className="ov-kpi__value">{(statusCounts.CANCELLED + statusCounts.RESCHEDULED).toLocaleString()}</div>
            </div>
          </div>

          {routineView === "board" ? (
            <RoutineBoard rows={viewRows} onMove={handleMove} moving={saving} />
          ) : (
            <OfficialRoutineView
              officialSheets={officialSheets}
              semesters={semesters}
              semesterId={semesterId}
              viewType={viewType}
              viewRows={viewRows}
            />
          )}
        </>
      ) : null}

      <GenerateRoutineModal
        open={genOpen}
        generating={generating}
        semesters={semesters}
        genDepartments={genDepartments}
        runningBatches={runningBatches}
        genSem={genSem}
        examType={examType}
        genDept={genDept}
        selectedBatchIds={selectedBatchIds}
        startDate={startDate}
        endDate={endDate}
        slots={slots}
        studentsPerSection={studentsPerSection}
        gapDays={gapDays}
        skipDays={skipDays}
        replace={replace}
        genError={genError}
        onClose={() => setGenOpen(false)}
        onSubmit={() => void submitGenerate()}
        onGenSemChange={setGenSem}
        onExamTypeChange={setExamType}
        onGenDeptChange={setGenDept}
        onToggleBatch={toggleBatch}
        onSetManyBatches={setManyBatches}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onGapDaysChange={setGapDays}
        onUpdateSlot={updateSlot}
        onAddSlot={addSlot}
        onRemoveSlot={removeSlot}
        onStudentsPerSectionChange={setStudentsPerSection}
        onToggleSkipDay={toggleSkipDay}
        onReplaceChange={setReplace}
      />

      <EditExamModal
        editing={editing}
        saving={saving}
        eDate={eDate}
        eStart={eStart}
        eEnd={eEnd}
        eStatus={eStatus}
        eStudents={eStudents}
        eRoomId={eRoomId}
        editError={editError}
        roomOptions={roomOptions}
        onClose={() => setEditing(null)}
        onSubmit={() => void submitEdit()}
        onEDateChange={setEDate}
        onEStartChange={setEStart}
        onEEndChange={setEEnd}
        onEStatusChange={setEStatus}
        onEStudentsChange={setEStudents}
        onERoomIdChange={setERoomId}
      />

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete exam"
        message={`Delete ${pendingDelete?.course_code ?? ""} (${pendingDelete?.dept ?? ""} B${pendingDelete?.batch ?? ""}${pendingDelete?.section ? "-" + pendingDelete.section : ""}) on ${pendingDelete?.exam_date ?? ""}?`}
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
      <ConfirmModal
        open={pendingDeleteRoutine}
        title="Delete routine"
        message={`Delete the ${routineDeleteLabel} for ${routineSemesterName}? This will remove ${rows.length} exam(s) and any assigned invigilation duties. This cannot be undone.`}
        confirmLabel="Delete routine"
        busy={deletingRoutine}
        onClose={() => setPendingDeleteRoutine(false)}
        onConfirm={() => void confirmDeleteRoutine()}
      />
      <ConfirmModal
        open={Boolean(pendingRegenWarning)}
        title="Replace Existing Routine?"
        message={`${pendingRegenWarning ?? ""}\n\nDelete them and regenerate?`}
        confirmLabel="Replace & Regenerate"
        busy={generating}
        onClose={() => {
          setPendingRegenWarning(null);
          setGenError("Regeneration cancelled — nothing was changed.");
        }}
        onConfirm={() => void confirmRegenerate()}
      />
      <RoomSeatingModal
        open={seatingModalOpen}
        onClose={() => setSeatingModalOpen(false)}
        semesterId={semesterId}
      />
    </>
  );
}
