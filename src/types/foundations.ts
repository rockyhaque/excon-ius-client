export type Id = string;

export type CourseKind = "THEORY" | "LAB";
export type BatchStatus = "RUNNING" | "COMPLETED";

export type Department = { id: Id; name: string; code: string };
export type Batch = {
  id: Id;
  dept_id: Id;
  number?: number;
  name?: string;
  dept_name?: string;
  status?: BatchStatus;
};
export type Section = { id: Id; batch_id: Id; name: string; batch_name?: string; dept_name?: string };
export type Course = {
  id: Id;
  dept_id: Id;
  name: string;
  code: string;
  dept_name?: string;
  kind?: CourseKind;
  credit?: number;
  batch_ids?: string[];
};

export const MAX_SEMESTER_CREDITS = 20;


