import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import "@/styles/overview.css";
import { getErrorMessage } from "@/utils/getErrorMessage";
import {
  useApproveLeaveMutation,
  useGetLeaveHistoryQuery,
  useGetLeaveRequestsQuery,
  useRejectLeaveMutation,
} from "@/redux/features/leaves/leaves.api";
import { AreaChart, ChartCard, DonutChart, HBarList, VIZ } from "@/components/overview/charts";
import { bucketByDate, leaveDays, sumBy } from "@/utils/stats";

type LeaveRow = {
  id: number | string;
  teacher_name?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  status?: string;
  created_at?: string;
};

function fmtDate(v: unknown): string {
  const s = String(v || "");
  if (!s) return "—";
  // Handles "2026-06-10T00:00:00.000Z" and "2026-06-10"
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

function statusPill(statusRaw: unknown) {
  const s = String(statusRaw || "").toUpperCase();
  if (s === "APPROVED") return <span className="foundations__badge">Approved</span>;
  if (s === "REJECTED") return <span className="foundations__badge foundations__badge--danger">Rejected</span>;
  return <span className="foundations__badge">Pending</span>;
}

function byCreatedDesc(a: LeaveRow, b: LeaveRow) {
  const ad = Date.parse(String(a.created_at || "")) || 0;
  const bd = Date.parse(String(b.created_at || "")) || 0;
  return bd - ad;
}

export function AdminLeaveRequestsPanel() {
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const pendingQuery = useGetLeaveRequestsQuery(undefined, { skip: tab !== "pending" });
  // History is fetched unconditionally so the stats + charts stay populated on both tabs.
  const allQuery = useGetLeaveHistoryQuery();

  const dataRaw = tab === "pending" ? pendingQuery.data : allQuery.data;
  const isLoading = tab === "pending" ? pendingQuery.isLoading : allQuery.isLoading;
  const error = tab === "pending" ? pendingQuery.error : allQuery.error;

  const rows = useMemo(() => {
    const list = (dataRaw ?? []) as unknown[];
    return (Array.isArray(list) ? list : []).map((r) => r as LeaveRow).slice().sort(byCreatedDesc);
  }, [dataRaw]);

  // ── All-history rows drive the stat tiles and charts ──────────────
  const allRows = useMemo(() => {
    const list = (allQuery.data ?? []) as unknown[];
    return (Array.isArray(list) ? list : []).map((r) => r as LeaveRow);
  }, [allQuery.data]);

  const counts = useMemo(() => {
    const c = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    allRows.forEach((r) => {
      const s = String(r.status || "").toUpperCase();
      if (s === "APPROVED") c.APPROVED++;
      else if (s === "REJECTED") c.REJECTED++;
      else if (s === "PENDING") c.PENDING++;
    });
    return c;
  }, [allRows]);

  const daysByTeacher = useMemo(
    () => sumBy(allRows, (r) => String(r.teacher_name || ""), (r) => leaveDays(r.start_date, r.end_date), 12),
    [allRows],
  );
  const requestsOverTime = useMemo(
    () => bucketByDate(allRows, (r) => String(r.created_at || "")),
    [allRows],
  );

  const [approve, { isLoading: approving }] = useApproveLeaveMutation();
  const [reject, { isLoading: rejecting }] = useRejectLeaveMutation();

  const onApprove = async (row: LeaveRow) => {
    if (!window.confirm(`Approve leave for ${row.teacher_name ?? "teacher"}?`)) return;
    try {
      await approve(row.id).unwrap();
      toast.success("Leave approved.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Could not approve leave."));
    }
  };

  const onReject = async (row: LeaveRow) => {
    if (!window.confirm(`Reject leave for ${row.teacher_name ?? "teacher"}?`)) return;
    try {
      await reject(row.id).unwrap();
      toast.success("Leave rejected.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Could not reject leave."));
    }
  };

  return (
    <div className="foundations">
      <div className="card foundations__card">
        <div className="foundations__page-head">
          <div>
            <h1 style={{ margin: 0 }}>Leave Requests</h1>
            <p className="foundations__lead">Approve or reject teacher leave requests.</p>
          </div>
        </div>

        <div className="foundations__stats">
          <div className="foundations__stat">
            <div className="foundations__stat-label">Pending</div>
            <div className="foundations__stat-value" style={{ color: counts.PENDING > 0 ? VIZ.warning : undefined }}>
              {counts.PENDING}
            </div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Approved</div>
            <div className="foundations__stat-value">{counts.APPROVED}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Rejected</div>
            <div className="foundations__stat-value">{counts.REJECTED}</div>
          </div>
          <div className="foundations__stat">
            <div className="foundations__stat-label">Total requests</div>
            <div className="foundations__stat-value">{allRows.length}</div>
          </div>
        </div>

        <div className="ov-grid" style={{ marginBottom: 16 }}>
          <ChartCard title="Leave status" subtitle="All requests by outcome">
            <DonutChart
              centerLabel="requests"
              data={[
                { label: "Approved", value: counts.APPROVED, color: VIZ.good },
                { label: "Pending", value: counts.PENDING, color: VIZ.warning },
                { label: "Rejected", value: counts.REJECTED, color: VIZ.critical },
              ]}
            />
          </ChartCard>

          <ChartCard title="Leave days by teacher" subtitle="Total requested days (top 12)">
            <HBarList data={daysByTeacher} unit="days" />
          </ChartCard>

          <ChartCard title="Requests over time" subtitle="Leave requests by submission date" wide>
            <AreaChart data={requestsOverTime} color={VIZ.orange} />
          </ChartCard>
        </div>

        <div className="foundations__tabs">
          <button
            type="button"
            className={`foundations__tab ${tab === "pending" ? "foundations__tab--active" : ""}`}
            onClick={() => setTab("pending")}
          >
            Pending
            {counts.PENDING > 0 ? (
              <span
                style={{
                  marginLeft: 8,
                  display: "inline-flex",
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  background: VIZ.warning,
                }}
              >
                {counts.PENDING}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={`foundations__tab ${tab === "all" ? "foundations__tab--active" : ""}`}
            onClick={() => setTab("all")}
          >
            All history
          </button>
        </div>

        {isLoading ? <p className="foundations__muted">Loading…</p> : null}
        {error ? <p className="foundations__error">Could not load leave requests.</p> : null}

        <div className="foundations__table-wrap">
          <table className="foundations__table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Dates</th>
                <th>Status</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                <td colSpan={4} className="foundations__empty">
                    {tab === "pending" ? "No pending leave requests." : "No leave history yet."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const status = String(r.status || "").toUpperCase();
                  const canAct = status === "PENDING";
                  return (
                    <tr key={String(r.id)}>
                      <td>
                        <strong>{r.teacher_name || "—"}</strong>
                      </td>
                      <td>
                        {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                        {r.reason ? (
                          <div className="foundations__muted" style={{ margin: 0 }}>
                            {r.reason}
                          </div>
                        ) : null}
                      </td>
                      <td>{statusPill(r.status)}</td>
                      <td>
                        {canAct ? (
                          <div className="foundations__actions">
                            <button
                              type="button"
                              className="foundations__btn foundations__btn--ghost"
                              disabled={approving || rejecting}
                              onClick={() => void onApprove(r)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="foundations__danger"
                              disabled={approving || rejecting}
                              onClick={() => void onReject(r)}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="foundations__muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

