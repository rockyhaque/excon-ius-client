import { baseApi } from "@/redux/baseApi";

/**
 * Rows differ per endpoint (activity / allocation-history / leave-approvals / admin-actions),
 * so this is a permissive superset — panels read only the fields relevant to the active tab.
 */
export type LogRow = {
  id?: string | number;
  created_at?: string;
  updated_at?: string;
  // activity + admin actions
  action?: string;
  details?: unknown;
  user_name?: string;
  user_role?: string;
  admin_name?: string;
  // allocation history
  course_name?: string;
  exam_date?: string;
  room_name?: string;
  teacher_name?: string;
  status?: string;
  // leave approvals
  start_date?: string;
  end_date?: string;
  reason?: string;
  [key: string]: unknown;
};

function normalizeListResponse(res: unknown): LogRow[] {
  if (Array.isArray(res)) return res as LogRow[];
  const data = (res as { data?: unknown })?.data;
  if (Array.isArray(data)) return data as LogRow[];
  return [];
}

export const logsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getActivityLogs: builder.query<LogRow[], void>({
      query: () => ({ url: "/logs/activity", method: "GET" }),
      transformResponse: normalizeListResponse,
      providesTags: ["LOGS"],
    }),
    getAllocationHistoryLogs: builder.query<LogRow[], void>({
      query: () => ({ url: "/logs/allocation-history", method: "GET" }),
      transformResponse: normalizeListResponse,
      providesTags: ["LOGS"],
    }),
    getLeaveApprovalLogs: builder.query<LogRow[], void>({
      query: () => ({ url: "/logs/leave-approvals", method: "GET" }),
      transformResponse: normalizeListResponse,
      providesTags: ["LOGS"],
    }),
    getAdminActionLogs: builder.query<LogRow[], void>({
      query: () => ({ url: "/logs/admin-actions", method: "GET" }),
      transformResponse: normalizeListResponse,
      providesTags: ["LOGS"],
    }),
  }),
});

export const {
  useGetActivityLogsQuery,
  useGetAllocationHistoryLogsQuery,
  useGetLeaveApprovalLogsQuery,
  useGetAdminActionLogsQuery,
} = logsApi;
