import { useState } from "react";
import "@/styles/teacher.css";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Tabs } from "@/components/ui/Tabs";
import { PageCard } from "@/components/ui/PageCard";
import { EmptyRow, Table } from "@/components/ui/Table";
import {
  useApplyLeaveMutation,
  useCancelLeaveMutation,
  useGetLeaveHistoryQuery,
} from "@/redux/features/leaves/leaves.api";
import type { TeacherLeaveRow } from "@/types/teacher";
import { useSkipTeacherApi } from "@/hooks/useTeacherProfile";
import { toast } from "react-toastify";
import { getErrorMessage } from "@/utils/getErrorMessage";

function fmtDate(v: unknown): string {
  const s = String(v || "");
  if (!s) return "—";
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

export function TeacherLeavesPanel() {
  const skipApi = useSkipTeacherApi();
  const { data: rows = [], isLoading, error, refetch } = useGetLeaveHistoryQuery(undefined, { skip: skipApi });
  const [apply, { isLoading: applying }] = useApplyLeaveMutation();
  const [cancel, { isLoading: cancelling }] = useCancelLeaveMutation();

  const [tab, setTab] = useState<"list" | "apply">("list");
  const [open, setOpen] = useState(false);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [cause, setCause] = useState("Sick");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const CAUSES = ["Sick", "Personal", "Family", "Official", "Other"] as const;

  const submit = async () => {
    if (skipApi) return;
    setFormError(null);
    if (!start || !end) {
      setFormError("Start and end dates are required.");
      return;
    }
    try {
      const detail = reason.trim();
      const reasonText = detail ? `${cause} — ${detail}` : cause;
      await apply({ start_date: start, end_date: end, reason: reasonText }).unwrap();
      setStart("");
      setEnd("");
      setCause("Sick");
      setReason("");
      setOpen(false);
      setTab("list");
      toast.success("Leave request submitted.");
      await refetch();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Could not submit leave request.");
      setFormError(msg);
      toast.error(msg);
    }
  };

  const onCancel = async (id: string) => {
    try {
      await cancel(id).unwrap();
      toast.success("Leave request cancelled.");
      await refetch();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Could not cancel (only PENDING can be cancelled).");
      setFormError(msg);
      toast.error(msg);
    }
  };

  const list = rows as TeacherLeaveRow[];

  return (
    <PageCard title="My leave requests" lead="View, apply, and cancel (pending) leave requests.">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "list", label: "Requests" },
          { id: "apply", label: "Apply leave" },
        ]}
      />

        <div className="foundations__toolbar">
          <div className="foundations__toolbar-left">
            {skipApi ? <span className="foundations__muted" style={{ margin: 0 }}>Sign in to manage leave.</span> : null}
          </div>
          <div className="foundations__toolbar-right">
            <button
              className="foundations__btn"
              type="button"
              disabled={skipApi}
              onClick={() => {
                setFormError(null);
                setOpen(true);
                setTab("apply");
              }}
            >
              + Apply leave
            </button>
          </div>
        </div>

        {tab === "list" ? (
          <>
            {skipApi ? <p className="foundations__muted">Sign in to load your leave history.</p> : null}
            {!skipApi && isLoading ? <p className="foundations__muted">Loading…</p> : null}
            {!skipApi && error ? <p className="foundations__error">Could not load leave history.</p> : null}

            <Table
              head={
                <thead>
                  <tr>
                    <th>Dates</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th style={{ width: 160 }}>Action</th>
                  </tr>
                </thead>
              }
            >
              <tbody>
                {!skipApi && !isLoading && !error && list.length === 0 ? <EmptyRow colSpan={4}>No leave requests yet.</EmptyRow> : null}
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {fmtDate(row.start_date)} → {fmtDate(row.end_date)}
                    </td>
                    <td>{row.reason ?? "—"}</td>
                    <td>
                      <span className="foundations__badge">{String(row.status || "—")}</span>
                    </td>
                    <td>
                      {String(row.status).toUpperCase() === "PENDING" ? (
                        <button
                          type="button"
                          className="foundations__danger"
                          disabled={cancelling}
                          onClick={() => setPendingCancelId(String(row.id))}
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="foundations__muted" style={{ margin: 0 }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        ) : (
          <div className="foundations__muted" style={{ margin: 0 }}>
            Click “+ Apply leave” to open the form.
          </div>
        )}

        <Modal
          open={open}
          title="Apply leave"
          onClose={() => setOpen(false)}
          footer={
            <div className="foundations__modal-actions">
              <button className="foundations__btn foundations__btn--ghost" type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="foundations__btn" type="button" disabled={applying || skipApi} onClick={() => void submit()}>
                {applying ? "Submitting…" : "Submit request"}
              </button>
            </div>
          }
        >
          <div className="foundations__form">
            <label className="foundations__field">
              <span>Start date</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <label className="foundations__field">
              <span>End date</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </label>
            <label className="foundations__field">
              <span>Cause</span>
              <select value={cause} onChange={(e) => setCause(e.target.value)}>
                {CAUSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="foundations__field">
              <span>Details (optional)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Add a short note if the cause needs one"
                style={{ minHeight: 90, resize: "vertical", borderRadius: 10, padding: "9px 10px", border: "1px solid #d1d5db", font: "inherit" }}
              />
            </label>
            {formError ? <div className="foundations__error">{formError}</div> : null}
          </div>
        </Modal>

        <ConfirmModal
          open={Boolean(pendingCancelId)}
          title="Cancel Leave Request"
          message="Are you sure you want to cancel this leave request? This cannot be undone."
          confirmLabel="Cancel Request"
          busy={cancelling}
          onClose={() => setPendingCancelId(null)}
          onConfirm={async () => {
            if (!pendingCancelId) return;
            const id = pendingCancelId;
            setPendingCancelId(null);
            await onCancel(id);
          }}
        />
    </PageCard>
  );
}
