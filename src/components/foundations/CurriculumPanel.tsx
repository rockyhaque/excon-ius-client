import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { getErrorMessage } from "@/utils/getErrorMessage";
import {
  useGetDepartmentsQuery,
  useGetBatchesQuery,
  useGetCoursesQuery,
  useGetBatchCoursesQuery,
  useSetBatchCoursesMutation,
} from "@/redux/features/foundations/foundations.api";
import { mapBatches, mapCourses, mapDepartments } from "@/components/foundations/foundations.types";

export function CurriculumPanel() {
  const { data: depsRaw = [] } = useGetDepartmentsQuery({ limit: 100 });
  const { data: batchesRaw = [] } = useGetBatchesQuery({ limit: 100 });
  const { data: coursesRaw = [] } = useGetCoursesQuery({ limit: 100 });

  const deps = useMemo(() => mapDepartments(depsRaw), [depsRaw]);
  const batches = useMemo(() => mapBatches(batchesRaw), [batchesRaw]);
  const courses = useMemo(() => mapCourses(coursesRaw), [coursesRaw]);

  const [deptId, setDeptId] = useState("");
  const [batchId, setBatchId] = useState("");

  useEffect(() => {
    if (!deptId && deps.length > 0) setDeptId(String(deps[0].id));
  }, [deps, deptId]);

  const deptBatches = useMemo(
    () => batches.filter((b) => !deptId || String(b.dept_id) === deptId),
    [batches, deptId],
  );
  const deptCourses = useMemo(
    () => courses.filter((c) => !deptId || String(c.dept_id) === deptId),
    [courses, deptId],
  );

  useEffect(() => {
    // keep a valid batch selected for the chosen department
    if (deptBatches.length === 0) { setBatchId(""); return; }
    if (!deptBatches.some((b) => String(b.id) === batchId)) setBatchId(String(deptBatches[0].id));
  }, [deptBatches, batchId]);

  // NOTE: no `= []` default — a fresh [] each render makes currIds unstable and loops the effect below.
  const { data: currRaw, isFetching: loadingCurr } = useGetBatchCoursesQuery(batchId, { skip: !batchId });
  const currIds = useMemo(
    () => new Set(((currRaw ?? []) as { id?: unknown }[]).map((c) => String(c.id))),
    [currRaw],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    // reset local selection whenever the batch's saved curriculum loads
    setSelected(new Set(currIds));
  }, [currIds, batchId]);

  const [save, { isLoading: saving }] = useSetBatchCoursesMutation();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const setAll = (on: boolean) => setSelected(on ? new Set(deptCourses.map((c) => String(c.id))) : new Set());

  const dirty = useMemo(() => {
    if (selected.size !== currIds.size) return true;
    for (const id of selected) if (!currIds.has(id)) return true;
    return false;
  }, [selected, currIds]);

  const onSave = async () => {
    if (!batchId) return;
    try {
      await save({ batchId, course_ids: [...selected] }).unwrap();
      toast.success("Curriculum saved.");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not save curriculum."));
    }
  };

  const batchLabel = (b: (typeof batches)[number]) => `Batch ${b.name ?? b.number}`;

  return (
    <>
      <div className="foundations__toolbar">
        <div className="foundations__toolbar-left">
          <h2 className="foundations__h2" style={{ margin: 0 }}>Curriculum</h2>
          <span className="foundations__muted" style={{ margin: 0 }}>
            Choose the courses each batch sits. The exam-routine generator uses this; a batch with
            <strong> no courses selected falls back to all department courses</strong>.
          </span>
        </div>
      </div>

      <div className="foundations__form" style={{ gridTemplateColumns: "1fr 1fr", display: "grid", gap: 12, maxWidth: 620 }}>
        <label className="foundations__field">
          <span>Department</span>
          <select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            {deps.length === 0 ? <option value="">No departments</option> : null}
            {deps.map((d) => <option key={d.id} value={String(d.id)}>{d.name} ({d.code})</option>)}
          </select>
        </label>
        <label className="foundations__field">
          <span>Batch</span>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={deptBatches.length === 0}>
            {deptBatches.length === 0 ? <option value="">No batches in this department</option> : null}
            {deptBatches.map((b) => <option key={b.id} value={String(b.id)}>{batchLabel(b)}</option>)}
          </select>
        </label>
      </div>

      {!batchId ? (
        <p className="foundations__muted">Select a department and batch to edit its curriculum.</p>
      ) : deptCourses.length === 0 ? (
        <p className="foundations__muted">This department has no courses yet. Add courses first.</p>
      ) : (
        <div style={{ marginTop: 8 }}>
          <div className="foundations__toolbar" style={{ margin: "4px 0 10px" }}>
            <div className="foundations__toolbar-left">
              <span className="foundations__muted" style={{ margin: 0 }}>
                {loadingCurr ? "Loading…" : `${selected.size} of ${deptCourses.length} course(s) selected`}
              </span>
            </div>
            <div className="foundations__toolbar-right">
              <button type="button" className="foundations__btn foundations__btn--ghost" onClick={() => setAll(true)}>Select all</button>
              <button type="button" className="foundations__btn foundations__btn--ghost" onClick={() => setAll(false)}>Clear</button>
              <button type="button" className="foundations__btn" onClick={() => void onSave()} disabled={saving || !dirty}>
                {saving ? "Saving…" : dirty ? "Save curriculum" : "Saved"}
              </button>
            </div>
          </div>

          <div className="curriculum__grid">
            {deptCourses.map((c) => {
              const id = String(c.id);
              const on = selected.has(id);
              return (
                <label key={id} className={`curriculum__item ${on ? "curriculum__item--on" : ""}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(id)} />
                  <span>
                    <strong>{c.code}</strong>
                    <span className="foundations__muted" style={{ margin: 0, display: "block" }}>{c.name}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
