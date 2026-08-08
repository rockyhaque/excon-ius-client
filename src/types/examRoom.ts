export type ExamRoomEntity = Record<string, unknown> & { id?: number | string };

export type Room = {
  id: string;
  name: string;
  building: string;
  capacity: number;
  is_defect: boolean;
};

export type Exam = {
  id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  dept_id: string;
  dept: string;
  batch_id: string;
  batch: string;
  section_id: string;
  section: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  status: string;
  exam_type: string;
  expected_students: number | null;
  semester_name: string;
  room_id: string;
  room_name: string;
  room_building: string;
  room_capacity: number | null;
};

