import { baseApi } from "@/redux/baseApi";

export type FoundationEntity = Record<string, unknown> & { id?: number };

function normalizeListResponse(res: unknown): FoundationEntity[] {
  if (Array.isArray(res)) return res as FoundationEntity[];
  const data = (res as any)?.data;
  if (Array.isArray(data)) return data as FoundationEntity[];
  return [];
}

export const foundationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDepartments: builder.query<FoundationEntity[], void | Record<string, unknown>>({
      query: (params) => ({ url: "/foundations/departments", method: "GET", params: params ?? undefined }),
      transformResponse: normalizeListResponse,
      providesTags: ["FOUNDATIONS"],
    }),
    createDepartment: builder.mutation<FoundationEntity, { name: string; code: string }>({
      query: (data) => ({ url: "/foundations/departments", method: "POST", data }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    updateDepartment: builder.mutation<FoundationEntity, { id: number | string; data: Record<string, unknown> }>({
      query: ({ id, data }) => ({ url: `/foundations/departments/${id}`, method: "PUT", data }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    deleteDepartment: builder.mutation<{ message: string }, number | string>({
      query: (id) => ({ url: `/foundations/departments/${id}`, method: "DELETE" }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    getBatches: builder.query<FoundationEntity[], void | Record<string, unknown>>({
      query: (params) => ({ url: "/foundations/batches", method: "GET", params: params ?? undefined }),
      transformResponse: normalizeListResponse,
      providesTags: ["FOUNDATIONS"],
    }),
    createBatch: builder.mutation<FoundationEntity, Record<string, unknown>>({
      query: (data) => ({ url: "/foundations/batches", method: "POST", data }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    updateBatch: builder.mutation<FoundationEntity, { id: number | string; data: Record<string, unknown> }>({
      query: ({ id, data }) => ({ url: `/foundations/batches/${id}`, method: "PUT", data }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    deleteBatch: builder.mutation<{ message: string }, number | string>({
      query: (id) => ({ url: `/foundations/batches/${id}`, method: "DELETE" }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    getSections: builder.query<FoundationEntity[], void | Record<string, unknown>>({
      query: (params) => ({ url: "/foundations/sections", method: "GET", params: params ?? undefined }),
      transformResponse: normalizeListResponse,
      providesTags: ["FOUNDATIONS"],
    }),
    createSection: builder.mutation<FoundationEntity, Record<string, unknown>>({
      query: (data) => ({ url: "/foundations/sections", method: "POST", data }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    updateSection: builder.mutation<FoundationEntity, { id: number | string; data: Record<string, unknown> }>({
      query: ({ id, data }) => ({ url: `/foundations/sections/${id}`, method: "PUT", data }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    deleteSection: builder.mutation<{ message: string }, number | string>({
      query: (id) => ({ url: `/foundations/sections/${id}`, method: "DELETE" }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    getCourses: builder.query<FoundationEntity[], void | Record<string, unknown>>({
      query: (params) => ({ url: "/foundations/courses", method: "GET", params: params ?? undefined }),
      transformResponse: normalizeListResponse,
      providesTags: ["FOUNDATIONS"],
    }),
    createCourse: builder.mutation<FoundationEntity, Record<string, unknown>>({
      query: (data) => ({ url: "/foundations/courses", method: "POST", data }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    updateCourse: builder.mutation<FoundationEntity, { id: number | string; data: Record<string, unknown> }>({
      query: ({ id, data }) => ({ url: `/foundations/courses/${id}`, method: "PUT", data }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    deleteCourse: builder.mutation<{ message: string }, number | string>({
      query: (id) => ({ url: `/foundations/courses/${id}`, method: "DELETE" }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    getSemesters: builder.query<FoundationEntity[], void>({
      query: () => ({ url: "/foundations/semesters", method: "GET" }),
      transformResponse: normalizeListResponse,
      providesTags: ["FOUNDATIONS"],
    }),
    createSemester: builder.mutation<FoundationEntity, { name: string; season: string; year: number; is_current?: boolean }>({
      query: (data) => ({ url: "/foundations/semesters", method: "POST", data }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    updateSemester: builder.mutation<FoundationEntity, { id: number | string; data: Record<string, unknown> }>({
      query: ({ id, data }) => ({ url: `/foundations/semesters/${id}`, method: "PUT", data }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    deleteSemester: builder.mutation<{ message: string }, number | string>({
      query: (id) => ({ url: `/foundations/semesters/${id}`, method: "DELETE" }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
    getBatchCourses: builder.query<FoundationEntity[], string>({
      query: (batchId) => ({ url: `/foundations/batches/${batchId}/courses`, method: "GET" }),
      transformResponse: normalizeListResponse,
      providesTags: ["FOUNDATIONS"],
    }),
    setBatchCourses: builder.mutation<{ message: string; data: FoundationEntity[] }, { batchId: string; course_ids: string[] }>({
      query: ({ batchId, course_ids }) => ({ url: `/foundations/batches/${batchId}/courses`, method: "PUT", data: { course_ids } }),
      invalidatesTags: ["FOUNDATIONS"],
    }),
  }),
});

export const {
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetBatchesQuery,
  useCreateBatchMutation,
  useUpdateBatchMutation,
  useDeleteBatchMutation,
  useGetSectionsQuery,
  useCreateSectionMutation,
  useUpdateSectionMutation,
  useDeleteSectionMutation,
  useGetCoursesQuery,
  useCreateCourseMutation,
  useUpdateCourseMutation,
  useDeleteCourseMutation,
  useGetSemestersQuery,
  useCreateSemesterMutation,
  useUpdateSemesterMutation,
  useDeleteSemesterMutation,
  useGetBatchCoursesQuery,
  useSetBatchCoursesMutation,
} = foundationsApi;
