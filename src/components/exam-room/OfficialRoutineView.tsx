import { officialDateLabel, officialExamTitle, type OfficialTableRow } from "@/utils/exports";
import type { ExamRow, ExamType, Semester } from "@/components/exam-room/examRoutine.types";

type OfficialSheet = {
  dept: string;
  rows: OfficialTableRow[];
};

export function OfficialRoutineView({
  officialSheets,
  semesters,
  semesterId,
  viewType,
  viewRows,
}: {
  officialSheets: OfficialSheet[];
  semesters: Semester[];
  semesterId: string;
  viewType: ExamType | "";
  viewRows: ExamRow[];
}) {
  return (
    <div className="ius-routine-stack">
      {officialSheets.map((sheet) => {
        const sem = semesters.find((x) => x.id === semesterId);
        return (
          <article key={sheet.dept} className="ius-sheet">
            <header className="ius-sheet__hdr">
              <div className="ius-sheet__dept">{sheet.dept}</div>
              <div className="ius-sheet__uni">
                University of Scholars
                <small>The International University of Scholars</small>
              </div>
            </header>
            <h3 className="ius-sheet__title">{officialExamTitle(viewType || viewRows[0]?.exam_type)}</h3>
            <p className="ius-sheet__sem">Semester: {sem?.name || "—"}</p>
            <div className="foundations__table-wrap">
              <table className="ius-table">
                <thead>
                  <tr>
                    <th style={{ width: "18%" }}>Date</th>
                    <th style={{ width: "16%" }}>Time</th>
                    <th style={{ width: "16%" }}>Course Code</th>
                    <th>Course Title</th>
                    <th style={{ width: "18%" }}>Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((r) => (
                    <tr key={`${r.date}-${r.start}-${r.course_code}`}>
                      {r.showDate ? (
                        <td className="ius-table__date" rowSpan={r.dateSpan}>
                          {officialDateLabel(r.date)}
                        </td>
                      ) : null}
                      {r.showTime ? (
                        <td className="ius-table__time" rowSpan={r.timeSpan}>
                          {r.start}–{r.end}
                        </td>
                      ) : null}
                      <td>{r.course_code}</td>
                      <td>{r.course_name}</td>
                      <td>{r.batches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        );
      })}
    </div>
  );
}
