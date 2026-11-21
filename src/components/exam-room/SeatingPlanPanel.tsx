import { useMemo, useState, useEffect } from "react";
import { toast } from "react-toastify";
import "@/styles/overview.css";
import "@/styles/foundations.css";
import { useGetSemestersQuery } from "@/redux/features/foundations/foundations.api";
import { useGetExamSeatingQuery } from "@/redux/features/exam-room/examRoom.api";
import { printDoorNotices } from "@/utils/exports";
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

  const handlePrintSingle = (session: any) => {
    const ok = printDoorNotices([session], { date: session.exam_date });
    if (!ok) {
      toast.error("Pop-up blocked — please allow pop-ups to print door notices.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Top Filter and Controls Bar */}
      <div className="foundations__toolbar" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="foundations__toolbar-left" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <h2 className="foundations__h2" style={{ margin: 0 }}>
              Seating Plan & Door Notices
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

          {/* Print PDF Button */}
          <button
            className="foundations__btn foundations__btn--primary"
            type="button"
            onClick={handlePrintAll}
            disabled={filteredSessions.length === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
          >
            🖨️ Print Door Notices (PDF)
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
        <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          Loading seating allocations…
        </div>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredSessions.map((session: any) => {
            const totalOcc = (session.columns || []).reduce((acc: number, c: any) => acc + (c.occupied_seats || 0), 0);
            return (
              <div
                key={`${session.exam_date}-${session.start_time}-${session.room_id}`}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 16,
                  background: "#ffffff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                {/* Room Card Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                    marginBottom: 14,
                    paddingBottom: 10,
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        background: "#5c0931",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 14,
                        padding: "3px 10px",
                        borderRadius: 6,
                      }}
                    >
                      Room {session.room_name}
                    </span>
                    <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                      {session.building || "Campus"} · Capacity: {session.room_capacity} seats
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: totalOcc >= session.room_capacity ? "#fef2f2" : "#f0fdf4",
                        color: totalOcc >= session.room_capacity ? "#991b1b" : "#166534",
                        fontWeight: 600,
                      }}
                    >
                      {totalOcc} / {session.room_capacity} seated
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                      📅 {session.exam_date} &nbsp;·&nbsp; 🕒 {session.start_time?.slice(0, 5)} – {session.end_time?.slice(0, 5)}
                    </div>
                    <button
                      type="button"
                      className="foundations__btn foundations__btn--ghost"
                      onClick={() => handlePrintSingle(session)}
                      style={{ fontSize: 12, padding: "4px 10px", borderColor: "#cbd5e1" }}
                      title="Print this individual room door notice"
                    >
                      🖨️ Print Notice
                    </button>
                  </div>
                </div>

                {/* 4-Column Classroom Layout Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${session.columns?.length || 4}, minmax(0, 1fr))`,
                    gap: 12,
                  }}
                >
                  {session.columns?.map((col: any) => {
                    const isEmpty = col.is_empty || !col.exam;
                    return (
                      <div
                        key={col.column_number}
                        style={{
                          background: isEmpty ? "#f8fafc" : "#f0fdf4",
                          border: isEmpty ? "1px dashed #cbd5e1" : "1px solid #bbf7d0",
                          borderRadius: 8,
                          padding: 12,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          minHeight: 120,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            color: isEmpty ? "#94a3b8" : "#166534",
                            borderBottom: isEmpty ? "1px dashed #e2e8f0" : "1px solid #dcfce7",
                            paddingBottom: 4,
                          }}
                        >
                          <span>COLUMN {col.column_number}</span>
                          <span style={{ fontSize: 11 }}>
                            {col.occupied_seats} / {col.max_seats} seats
                          </span>
                        </div>

                        {!isEmpty && col.exam ? (
                          <>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 2 }}>
                              {col.exam.course_code}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#374151",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={col.exam.course_name}
                            >
                              {col.exam.course_name}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                marginTop: "auto",
                                padding: "3px 8px",
                                borderRadius: 4,
                                background: "#e0f2fe",
                                color: "#0369a1",
                                width: "fit-content",
                                fontWeight: 600,
                              }}
                            >
                              {col.exam.dept} · B{col.exam.batch}
                              {col.exam.section ? ` (${col.exam.section})` : ""}
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#94a3b8",
                              fontStyle: "italic",
                              marginTop: "auto",
                              marginBottom: "auto",
                              textAlign: "center",
                              lineHeight: 1.4,
                            }}
                          >
                            Empty Buffer Column
                            <div style={{ fontSize: 10, color: "#cbd5e1" }}>(Anti-Cheating Aisle)</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
