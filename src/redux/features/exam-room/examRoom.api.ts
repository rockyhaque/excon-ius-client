import { baseApi } from "@/redux/baseApi";

export type ExamEntity = Record<string, unknown> & { id?: number | string };
export type RoomEntity = Record<string, unknown> & { id?: number | string };

export const examRoomApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExams: builder.query<ExamEntity[], void | Record<string, unknown>>({
      query: (params) => ({ url: "/exam-room/exams", method: "GET", params: params ?? undefined }),
      providesTags: ["EXAMS"],
    }),
    generateExamRoutine: builder.mutation<
      { message: string; summary: Record<string, unknown> },
      {
        semester_id: string;
        exam_type: "MIDTERM" | "FINAL";
        start_date: string;
        end_date: string;
        start_time?: string;
        end_time?: string;
        /** One or more non-overlapping daily slots (morning, afternoon, …). */
        slots?: { start_time: string; end_time: string }[];
        skip_weekends?: boolean;
        replace?: boolean;
        students_per_section?: number;
      }
    >({
      query: (data) => ({ url: "/exam-room/exams/generate-routine", method: "POST", data }),
      invalidatesTags: ["EXAMS"],
    }),
    getExamById: builder.query<ExamEntity, string | number>({
      query: (id) => ({ url: `/exam-room/exams/${id}`, method: "GET" }),
      providesTags: (_r, _e, id) => [{ type: "EXAMS", id: String(id) }],
    }),
    createExam: builder.mutation<ExamEntity, Record<string, unknown>>({
      query: (data) => ({ url: "/exam-room/exams", method: "POST", data }),
      invalidatesTags: ["EXAMS"],
    }),
    updateExam: builder.mutation<
      ExamEntity,
      { id: string | number; data: Record<string, unknown> }
    >({
      query: ({ id, data }) => ({
        url: `/exam-room/exams/${id}`,
        method: "PUT",
        data,
      }),
      invalidatesTags: ["EXAMS"],
    }),
    deleteExam: builder.mutation<{ message: string }, string | number>({
      query: (id) => ({ url: `/exam-room/exams/${id}`, method: "DELETE" }),
      invalidatesTags: ["EXAMS"],
    }),
    getRooms: builder.query<RoomEntity[], void | Record<string, unknown>>({
      query: (params) => ({ url: "/exam-room/rooms", method: "GET", params: params ?? undefined }),
      providesTags: ["ROOMS"],
    }),
    getRoomCapacity: builder.query<RoomEntity, string | number>({
      query: (id) => ({
        url: `/exam-room/rooms/${id}/capacity`,
        method: "GET",
      }),
      providesTags: (_r, _e, id) => [{ type: "ROOMS", id: String(id) }],
    }),
    createRoom: builder.mutation<RoomEntity, Record<string, unknown>>({
      query: (data) => ({ url: "/exam-room/rooms", method: "POST", data }),
      invalidatesTags: ["ROOMS"],
    }),
    updateRoom: builder.mutation<
      RoomEntity,
      { id: string | number; data: Record<string, unknown> }
>({
      query: ({ id, data }) => ({
        url: `/exam-room/rooms/${id}`,
        method: "PUT",
        data,
      }),
      invalidatesTags: ["ROOMS"],
    }),
    deleteRoom: builder.mutation<{ message: string }, string | number>({
      query: (id) => ({ url: `/exam-room/rooms/${id}`, method: "DELETE" }),
      invalidatesTags: ["ROOMS"],
    }),
    assignRoomToExam: builder.mutation<
      { message: string; data: unknown },
      { exam_id: number; room_id: number }
    >({
      query: (data) => ({
        url: "/exam-room/rooms/assign",
        method: "POST",
        data,
      }),
      invalidatesTags: ["EXAMS", "ROOMS", "ALLOCATIONS"],
    }),
  }),
});

export const {
  useGetExamsQuery,
  useGenerateExamRoutineMutation,
  useGetExamByIdQuery,
  useCreateExamMutation,
  useUpdateExamMutation,
  useDeleteExamMutation,
  useGetRoomsQuery,
  useGetRoomCapacityQuery,
  useCreateRoomMutation,
  useUpdateRoomMutation,
  useDeleteRoomMutation,
  useAssignRoomToExamMutation,
} = examRoomApi;
