import { useMemo, useState, useEffect } from "react";
import { LoadingSpinner } from "@/components/ui/Loading";
import { toast } from "react-toastify";
import "@/styles/overview.css";
import "@/styles/foundations.css";
import { useGetSemestersQuery } from "@/redux/features/foundations/foundations.api";
import { useGetExamSeatingQuery } from "@/redux/features/exam-room/examRoom.api";
import { printDoorNotices, downloadCsv } from "@/utils/exports";
import { arr, s, type Semester } from "@/components/exam-room/examRoutine.types";

interface SeatingPlanPanelProps {
  onNavigateToRoutine?: () => void;
}

export function SeatingPlanPanel({ onNavigateToRoutine }: SeatingPlanPanelProps) {
  const { data: semRaw } = useGetSemestersQuery();
  const semesters = useMemo<Semester[]>(
    () => arr(semRaw).map((x) => ({ id: s(x.id), name: s(x.name), season: s(x.season), year: s(x.year) })),
    [semRaw],
  );

  const [semesterId, setSemesterId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [roomSearch, setRoomSearch] = useState<string>("");

  useEffect(() => {
    if (!semesterId && semesters.length > 0) {
      const current = arr(semRaw).find((x) => x.is_current);
      setSemesterId(current ? s(current.id) : semesters[0]!.id);
    }
  }, [semesters, semRaw, semesterId]);

  const { data: seatingData = [], isLoading, error } = useGetExamSeatingQuery(
    semesterId ? { semester_id: semesterId } : undefined,
    { skip: !semesterId },
  );

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    seatingData.forEach((s: any) => {
      if (s.exam_date) dates.add(s.exam_date);
    });
    return Array.from(dates).sort();
  }, [seatingData]);

  // If selectedDate isn't set yet and dates exist, default to the first date
  const activeDate = selectedDate || (availableDates.length > 0 ? availableDates[0] : "");

  const filteredSessions = useMemo(() => {
    let list = seatingData;
    if (activeDate && activeDate !== "all") {
      list = list.filter((s: any) => s.exam_date === activeDate);
    }
    if (roomSearch.trim()) {
      const q = roomSearch.trim().toLowerCase();
      list = list.filter(
        (s: any) =>
          String(s.room_name || "").toLowerCase().includes(q) ||
          String(s.building || "").toLowerCase().includes(q) ||
          (s.columns || []).some(
            (c: any) =>
              c.exam &&
              (String(c.exam.course_code || "").toLowerCase().includes(q) ||
                String(c.exam.course_name || "").toLowerCase().includes(q) ||
                String(c.exam.dept || "").toLowerCase().includes(q)),
          ),
      );
    }
    return list;
  }, [seatingData, activeDate, roomSearch]);

  const stats = useMemo(() => {
    const totalRooms = filteredSessions.length;
    let totalCap = 0;
    let totalSeated = 0;
    let bufferColumns = 0;

    filteredSessions.forEach((s: any) => {
      totalCap += s.room_capacity || 0;
      (s.columns || []).forEach((c: any) => {
        totalSeated += c.occupied_seats || 0;
        if (c.is_empty || !c.exam) bufferColumns++;
      });
    });

    const occupancyRate = totalCap > 0 ? Math.round((totalSeated / totalCap) * 100) : 0;
    return { totalRooms, totalCap, totalSeated, bufferColumns, occupancyRate };
  }, [filteredSessions]);

  const handlePrintAll = () => {
    if (filteredSessions.length === 0) {
      toast.error("No classroom sessions available to print.");
      return;
    }
    const ok = printDoorNotices(filteredSessions, {
      date: activeDate !== "all" ? activeDate : undefined,
    });
    if (!ok) {
      toast.error("Pop-up blocked — please allow pop-ups to print door notices.");
    }
  };

  const handleExportCsv = () => {
    if (filteredSessions.length === 0) {
      toast.error("No seating data to export.");
      return;
    }
    const header = [
      "Room",
      "Building",
      "Date",
      "Time",
      "Seat",
      "Column",
      "Department",
      "Batch",
      "Section",
      "Course Code",
      "Students",
    ];
    const rows: Array<Array<string | number>> = [];
    filteredSessions.forEach((s: any) => {
      (s.columns || []).forEach((c: any) => {
        rows.push([
          s.room_name || "",
          s.building || "",
          s.exam_date || "",
          `${(s.start_time || "").slice(0, 5)} – ${(s.end_time || "").slice(0, 5)}`,
          s.room_capacity || 0,
          c.column_number,
          c.exam?.dept || "—",
          c.exam?.batch || "—",
          c.exam?.section || "—",
          c.exam?.course_code || "—",
          c.occupied_seats || 0,
        ]);
      });
    });
    downloadCsv(`Master_Seating_Plan_${activeDate || "all"}.csv`, header, rows);
    toast.success("Seating plan CSV downloaded.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Top Filter and Controls Bar */}
      <div className="foundations__toolbar" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="foundations__toolbar-left" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <h2 className="foundations__h2" style={{ margin: 0 }}>
              Seating Plan
            </h2>
            <p className="foundations__muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
              Column-based anti-cheating distribution and physical A4 door notices.
            </p>
          </div>
        </div>

        <div className="foundations__toolbar-right" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          {/* Semester Selector */}
          <select
            className="foundations__filter-control"
            value={semesterId}
            onChange={(e) => setSemesterId(e.target.value)}
            aria-label="Select Semester"
            style={{ fontWeight: 600 }}
          >
            {semesters.length === 0 ? <option value="">No semesters</option> : null}
            {semesters.map((sm) => (
              <option key={sm.id} value={sm.id}>
                {sm.name}
              </option>
            ))}
          </select>

          {/* Exam Date Selector */}
          {availableDates.length > 0 ? (
            <select
              className="foundations__filter-control"
              value={activeDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Filter by Exam Date"
              style={{ fontWeight: 500 }}
            >
              <option value="all">All Dates ({availableDates.length} exam days)</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : null}

          {/* Room / Keyword Search */}
          <input
            type="text"
            className="foundations__filter-control"
            placeholder="Search room, dept, code…"
            value={roomSearch}
            onChange={(e) => setRoomSearch(e.target.value)}
            style={{ width: 190 }}
          />

          {/* Export CSV Button */}
          <button
            className="foundations__btn foundations__btn--ghost"
            type="button"
            onClick={handleExportCsv}
            disabled={filteredSessions.length === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
          >
            Export CSV
          </button>

          {/* Print PDF Button */}
          <button
            className="foundations__btn foundations__btn--primary"
            type="button"
            onClick={handlePrintAll}
            disabled={filteredSessions.length === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
          >
            🖨️ Print (PDF)
          </button>
        </div>
      </div>

      {/* KPI / Summary Highlights */}
      {!isLoading && seatingData.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
              Active Filter Date
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
              {activeDate === "all" ? "All Exam Dates" : activeDate || "None"}
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
              Scheduled Halls
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
              {stats.totalRooms} rooms active
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
              Students Seated
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#166534", marginTop: 2 }}>
              {stats.totalSeated} / {stats.totalCap} ({stats.occupancyRate}%)
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
              Buffer Columns
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#2563eb", marginTop: 2 }}>
              {stats.bufferColumns} empty safety aisles
            </div>
          </div>
        </div>
      )}

      {/* Main Seating Content */}
      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="foundations__error" style={{ padding: 20 }}>
          Could not load the seating plan. Please verify that the server is reachable.
        </div>
      ) : seatingData.length === 0 ? (
        <div
          className="foundations__empty"
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fff",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>🪑</div>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600, color: "#111827" }}>
            No Seating Allocations Found
          </h3>
          <p className="foundations__muted" style={{ maxWidth: 440, margin: "0 auto 16px", fontSize: 13 }}>
            Seating plans are automatically computed from the Master Routine using alternating 4-column anti-cheating patterns.
          </p>
          {onNavigateToRoutine ? (
            <button
              className="foundations__btn foundations__btn--primary"
              type="button"
              onClick={onNavigateToRoutine}
            >
              Go to Master Routine →
            </button>
          ) : null}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div
          className="foundations__empty"
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fff",
            padding: "40px 20px",
            textAlign: "center",
          }}
        >
          <p className="foundations__muted" style={{ margin: 0 }}>
            No halls match your current date or search filter.
          </p>
        </div>
      ) : (
        <div
          className="foundations__table-wrap"
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            background: "#ffffff",
            overflowX: "auto",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <table className="foundations__table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "12px 12px", textAlign: "left", width: "7%" }}>Room</th>
                <th style={{ padding: "12px 12px", textAlign: "left", width: "11%" }}>Building</th>
                <th style={{ padding: "12px 12px", textAlign: "left", width: "11%" }}>Time</th>
                <th style={{ padding: "12px 10px", textAlign: "center", width: "6%" }}>Seat</th>
                <th style={{ padding: "12px 10px", textAlign: "center", width: "6%" }}>Column</th>
                <th style={{ padding: "12px 14px", textAlign: "left", width: "26%" }}>Department</th>
                <th style={{ padding: "12px 10px", textAlign: "center", width: "6%" }}>Batch</th>
                <th style={{ padding: "12px 10px", textAlign: "center", width: "6%" }}>Section</th>
                <th style={{ padding: "12px 14px", textAlign: "left", width: "14%" }}>Course Code</th>
                <th style={{ padding: "12px 12px", textAlign: "center", width: "7%", whiteSpace: "nowrap" }}>Students</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.flatMap((session: any) => {
                const cols = session.columns || [];
                return cols.map((col: any, colIdx: number) => {
                  const isEmpty = col.is_empty || !col.exam;
                  const isLastCol = colIdx === cols.length - 1;
                  return (
                    <tr
                      key={`${session.exam_date}-${session.start_time}-${session.room_id}-${col.column_number}`}
                      style={{
                        borderBottom: isLastCol ? "2px solid #cbd5e1" : "1px solid #f1f5f9",
                        background: isEmpty ? "#fafafa" : "#ffffff",
                      }}
                    >
                      {/* Room - Row-spanned per room */}
                      {colIdx === 0 && (
                        <td
                          rowSpan={cols.length || 1}
                          style={{
                            padding: "10px 14px",
                            fontWeight: 700,
                            fontSize: 14,
                            color: "#5c0931",
                            verticalAlign: "middle",
                            background: "#ffffff",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {session.room_name}
                        </td>
                      )}

                      {/* Building */}
                      <td style={{ padding: "10px 14px", fontSize: 13, color: "#475569" }}>
                        {session.building || "Campus"}
                      </td>

                      {/* Time */}
                      <td style={{ padding: "10px 12px", fontSize: 12.5, color: "#334155", whiteSpace: "nowrap" }}>
                        {session.start_time?.slice(0, 5)} – {session.end_time?.slice(0, 5)}
                      </td>

                      {/* Seat - Row-spanned per room (matches Room) */}
                      {colIdx === 0 && (
                        <td
                          rowSpan={cols.length || 1}
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            fontWeight: 600,
                            fontSize: 13,
                            color: "#475569",
                            verticalAlign: "middle",
                            background: "#ffffff",
                            borderLeft: "1px solid #e2e8f0",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {session.room_capacity}
                        </td>
                      )}

                      {/* Column */}
                      <td style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700, fontSize: 13, color: isEmpty ? "#94a3b8" : "#0f172a" }}>
                        {col.column_number}
                      </td>

                      {/* Department */}
                      <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13, color: isEmpty ? "#94a3b8" : "#1e293b" }}>
                        {col.exam ? col.exam.dept : "—"}
                      </td>

                      {/* Batch */}
                      <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13, color: isEmpty ? "#94a3b8" : "#334155" }}>
                        {col.exam ? col.exam.batch : "—"}
                      </td>

                      {/* Section */}
                      <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13, color: isEmpty ? "#94a3b8" : "#334155" }}>
                        {col.exam?.section || "—"}
                      </td>

                      {/* Course Code */}
                      <td style={{ padding: "10px 16px", fontWeight: 600, fontSize: 13, color: isEmpty ? "#94a3b8" : "#111827" }}>
                        {col.exam ? col.exam.course_code : <span style={{ color: "#9ca3af", fontStyle: "italic" }}>—</span>}
                      </td>

                      {/* Students */}
                      <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", color: isEmpty ? "#94a3b8" : "#166534" }}>
                        {col.occupied_seats}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
