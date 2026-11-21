import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useGetExamSeatingQuery } from "@/redux/features/exam-room/examRoom.api";
import { printDoorNotices } from "@/utils/exports";

interface RoomSeatingModalProps {
  open: boolean;
  onClose: () => void;
  semesterId: string;
}

export function RoomSeatingModal({ open, onClose, semesterId }: RoomSeatingModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const { data: seatingData = [], isLoading } = useGetExamSeatingQuery(
    semesterId ? { semester_id: semesterId } : undefined,
    { skip: !open || !semesterId }
  );

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    seatingData.forEach((s: any) => {
      if (s.exam_date) dates.add(s.exam_date);
    });
    return Array.from(dates).sort();
  }, [seatingData]);

  const activeDate = selectedDate || (availableDates.length > 0 ? availableDates[0] : "");

  const filteredSessions = useMemo(() => {
    if (!activeDate) return seatingData;
    return seatingData.filter((s: any) => s.exam_date === activeDate);
  }, [seatingData, activeDate]);

  const handlePrint = () => {
    printDoorNotices(filteredSessions, { date: activeDate });
  };

  return (
    <Modal
      open={open}
      title="Exam Hall Seating Plan (Column-Based Anti-Cheating Layout)"
      onClose={onClose}
      footer={
        <div className="foundations__modal-actions" style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          <button
            className="foundations__btn foundations__btn--primary"
            type="button"
            onClick={handlePrint}
            disabled={filteredSessions.length === 0}
          >
            🖨️ Print (PDF)
          </button>
          <button className="foundations__btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p className="foundations__muted" style={{ margin: 0, fontSize: 13 }}>
          Side-by-side columns strictly seat students from different departments or batches. Alternating columns (Col 1 & 3, Col 2 & 4) share cohorts.
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          {availableDates.length > 1 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Filter by Exam Date:</span>
              <select
                value={activeDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  background: "white",
                }}
              >
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          ) : <div />}
          <button
            type="button"
            className="foundations__btn foundations__btn--primary"
            onClick={handlePrint}
            disabled={filteredSessions.length === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            🖨️ Print (PDF)
          </button>
        </div>

        {isLoading ? (
          <p className="foundations__muted">Loading seating arrangements…</p>
        ) : filteredSessions.length === 0 ? (
          <div className="foundations__empty" style={{ padding: "30px 0" }}>
            No column seating records generated yet. Generate an exam routine first.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {filteredSessions.map((session: any) => (
              <div
                key={`${session.exam_date}-${session.start_time}-${session.room_id}`}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 16,
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                    borderBottom: "1px solid #e5e7eb",
                    paddingBottom: 8,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 15 }}>Room {session.room_name}</strong>
                    <span className="foundations__muted" style={{ marginLeft: 8 }}>
                      ({session.building} · Capacity: {session.room_capacity})
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#4b5563" }}>
                    {session.exam_date} · {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${session.columns?.length || 4}, 1fr)`,
                    gap: 10,
                  }}
                >
                  {session.columns?.map((col: any) => (
                    <div
                      key={col.column_number}
                      style={{
                        background: col.is_empty ? "#f3f4f6" : "#ffffff",
                        border: col.is_empty ? "1px dashed #d1d5db" : "1px solid #cbd5e1",
                        borderRadius: 6,
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          color: col.is_empty ? "#9ca3af" : "#2563eb",
                        }}
                      >
                        <span>Column {col.column_number}</span>
                        <span>
                          {col.occupied_seats}/{col.max_seats}
                        </span>
                      </div>

                      {col.exam ? (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                            {col.exam.course_code}
                          </div>
                          <div style={{ fontSize: 12, color: "#374151" }} title={col.exam.course_name}>
                            {col.exam.course_name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              marginTop: 6,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "#e0f2fe",
                              color: "#0369a1",
                              width: "fit-content",
                              fontWeight: 600,
                            }}
                          >
                            {col.exam.dept} · B{col.exam.batch} {col.exam.section ? `(${col.exam.section})` : ""}
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#9ca3af",
                            fontStyle: "italic",
                            marginTop: 14,
                            textAlign: "center",
                          }}
                        >
                          Empty Buffer Column
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
