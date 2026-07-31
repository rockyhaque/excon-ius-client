import { baseApi } from "@/redux/baseApi";
import type { UserRecord } from "@/types/users";

/** Teacher workload row from GET /users/workload (bare array). */
export type WorkloadRow = {
  id: string;
  name: string | null;
  employee_id: string | null;
  limit_value: number | null;
  current_allocations: number | string;
};

/** /users/all and /users/teachers are paginated → { data, pagination }; unwrap to the array. */
function normalizeUserList(res: unknown): UserRecord[] {
  if (Array.isArray(res)) return res as UserRecord[];
  const data = (res as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as UserRecord[]) : [];
}

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllUsers: builder.query<
      UserRecord[],
      | void
      | Partial<{
          search: string;
          role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | string;
          is_active: boolean;
          is_available: boolean;
          page: number;
          limit: number;
        }>
    >({
      query: (params) => ({ url: "/users/all", method: "GET", params: params ?? undefined }),
      transformResponse: normalizeUserList,
      providesTags: ["USERS"],
    }),
    getTeachers: builder.query<UserRecord[], void | Record<string, unknown>>({
      query: (params) => ({ url: "/users/teachers", method: "GET", params: params ?? undefined }),
      transformResponse: normalizeUserList,
      providesTags: ["USERS"],
    }),
    getWorkload: builder.query<WorkloadRow[], void>({
      query: () => ({ url: "/users/workload", method: "GET" }),
      transformResponse: (res: unknown) => (Array.isArray(res) ? (res as WorkloadRow[]) : ((res as { data?: WorkloadRow[] })?.data ?? [])),
      providesTags: ["USERS"],
    }),
    createAdmin: builder.mutation<UserRecord, { name: string; email: string; password: string }>({
      query: (data) => ({ url: "/users/admin", method: "POST", data }),
      invalidatesTags: ["USERS"],
    }),
    updateAdmin: builder.mutation<UserRecord, { id: string; body: Partial<Pick<UserRecord, "name" | "email">> & { is_active?: boolean } }>({
      query: ({ id, body }) => ({ url: `/users/admin/${id}`, method: "PUT", data: body }),
      invalidatesTags: ["USERS"],
    }),
    deleteAdmin: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/users/admin/${id}`, method: "DELETE" }),
      invalidatesTags: ["USERS"],
    }),
    deactivateAdmin: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/users/admin/deactivate/${id}`, method: "PATCH" }),
      invalidatesTags: ["USERS"],
    }),
    createTeacher: builder.mutation<
      UserRecord,
      { name: string; email: string; password: string; employee_id?: string; designation?: string }
    >({
      query: (data) => ({ url: "/users/teacher", method: "POST", data }),
      invalidatesTags: ["USERS"],
    }),
    updateTeacher: builder.mutation<
      UserRecord,
      {
        id: string;
        body: Partial<{
          name: string;
          email: string;
          is_active: boolean;
          designation: string;
          employee_id: string;
        }>;
      }
    >({
      query: ({ id, body }) => ({ url: `/users/teacher/${id}`, method: "PUT", data: body }),
      invalidatesTags: ["USERS"],
    }),
    deleteTeacher: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/users/teacher/${id}`, method: "DELETE" }),
      invalidatesTags: ["USERS"],
    }),
    deactivateTeacher: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/users/teacher/deactivate/${id}`, method: "PATCH" }),
      invalidatesTags: ["USERS"],
    }),
    setInvigilationLimit: builder.mutation<{ message: string }, { teacher_id: string; limit_value: number }>({
      query: (data) => ({ url: "/users/invigilation-limit", method: "POST", data }),
      invalidatesTags: ["USERS"],
    }),
    updatePersonalInfo: builder.mutation<
      UserRecord,
      Partial<{
        dob: string;
        marital_status: string;
        gender: string;
        emergency_contact: string;
        present_address: string;
        permanent_address: string;
      }>
    >({
      query: (data) => ({ url: "/users/personal-info", method: "PUT", data }),
      invalidatesTags: ["PROFILE", "USERS"],
    }),
  }),
});

export const {
  useGetAllUsersQuery,
  useGetTeachersQuery,
  useGetWorkloadQuery,
  useCreateAdminMutation,
  useUpdateAdminMutation,
  useDeleteAdminMutation,
  useDeactivateAdminMutation,
  useCreateTeacherMutation,
  useUpdateTeacherMutation,
  useDeleteTeacherMutation,
  useDeactivateTeacherMutation,
  useSetInvigilationLimitMutation,
  useUpdatePersonalInfoMutation,
} = usersApi;
