import { baseApi } from "@/redux/baseApi";
import type { PublishedAllocationRow } from "@/types/teacher";

export type RuleEntity = Record<string, unknown> & { id?: number | string };
export type TeacherSearchRow = {
  id: string;
  name: string;
  email: string;
  employee_id: string | null;
  designation: string | null;
};

export const allocationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    triggerAiAllocation: builder.mutation<{ message: string }, void>({
      query: () => ({ url: "/allocations/trigger-ai", method: "POST" }),
      invalidatesTags: ["ALLOCATIONS"],
    }),
    getAiAllocation: builder.query<unknown[], void>({
      query: () => ({ url: "/allocations/ai-allocation", method: "GET" }),
      providesTags: ["ALLOCATIONS"],
    }),
    editAllocation: builder.mutation<
      unknown,
      { id: string | number; body: { teacher_id: string; room_id: string } }
    >({
      query: ({ id, body }) => ({ url: `/allocations/${id}`, method: "PUT", data: body }),
      invalidatesTags: ["ALLOCATIONS"],
    }),
    publishAllocation: builder.mutation<{ message: string }, void>({
      query: () => ({ url: "/allocations/publish", method: "POST" }),
      invalidatesTags: ["ALLOCATIONS"],
    }),
    emergencyReallocate: builder.mutation<{ message: string }, { teacher_id: string }>({
      query: (data) => ({ url: "/allocations/emergency-reallocate", method: "POST", data }),
      invalidatesTags: ["ALLOCATIONS", "USERS"],
    }),
    getAllocationReports: builder.query<{ stats: unknown; workload: unknown }, void>({
      query: () => ({ url: "/allocations/reports", method: "GET" }),
      providesTags: ["ALLOCATIONS"],
    }),
    /** CSV text; use in download handler or `new Blob([data])`. */
    exportAllocationReport: builder.query<string, void>({
      query: () => ({
        url: "/allocations/reports/export",
        method: "GET",
        responseType: "text",
      }),
    }),
    getPublishedAllocations: builder.query<PublishedAllocationRow[], void>({
      query: () => ({ url: "/allocations/published", method: "GET" }),
      providesTags: ["ALLOCATIONS"],
    }),
    getAllocationConflicts: builder.query<Array<Record<string, unknown> & { reasons: string[] }>, void>({
      query: () => ({ url: "/allocations/conflicts", method: "GET" }),
      providesTags: ["ALLOCATIONS"],
    }),
    getTeacherInfo: builder.query<TeacherSearchRow[], string>({
      query: (search) => ({
        url: "/allocations/teacher-info",
        method: "GET",
        params: { search },
      }),
    }),
    getRules: builder.query<RuleEntity[], void>({
      query: () => ({ url: "/allocations/rules", method: "GET" }),
      providesTags: ["RULES"],
    }),
    createRule: builder.mutation<RuleEntity, { title: string; content: string; category: string }>({
      query: (data) => ({ url: "/allocations/rules", method: "POST", data }),
      invalidatesTags: ["RULES"],
    }),
    updateRule: builder.mutation<RuleEntity, { id: string | number; data: Record<string, unknown> }>({
      query: ({ id, data }) => ({ url: `/allocations/rules/${id}`, method: "PUT", data }),
      invalidatesTags: ["RULES"],
    }),
    deleteRule: builder.mutation<{ message: string }, string | number>({
      query: (id) => ({ url: `/allocations/rules/${id}`, method: "DELETE" }),
      invalidatesTags: ["RULES"],
    }),
  }),
});

export const {
  useTriggerAiAllocationMutation,
  useGetAiAllocationQuery,
  useEditAllocationMutation,
  usePublishAllocationMutation,
  useEmergencyReallocateMutation,
  useGetAllocationReportsQuery,
  useLazyExportAllocationReportQuery,
  useGetPublishedAllocationsQuery,
  useGetAllocationConflictsQuery,
  useGetTeacherInfoQuery,
  useLazyGetTeacherInfoQuery,
  useGetRulesQuery,
  useCreateRuleMutation,
  useUpdateRuleMutation,
  useDeleteRuleMutation,
} = allocationsApi;
