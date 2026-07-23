import axios, { type AxiosRequestConfig } from "axios";
import config from "@/config";
import { getAccessToken, setAccessToken } from "@/lib/authToken";

export const axiosInstance = axios.create({
  baseURL: config.baseUrl,
  withCredentials: true, // needed for refreshToken cookie
});

axiosInstance.interceptors.request.use(
  (req) => {
    const token = getAccessToken();
    if (token) {
      req.headers = req.headers ?? {};
      req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let pendingQueue: { resolve: () => void; reject: (e: unknown) => void }[] = [];

function processQueue(error?: unknown) {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  pendingQueue = [];
}

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // A 401 from the auth endpoints themselves means "bad credentials / no session",
    // NOT an expired access token — so don't try to refresh & retry (that just masks the
    // real "Invalid credentials" message behind a confusing refresh failure).
    const reqUrl = String(originalRequest?.url ?? "");
    const isAuthEndpoint = /\/auth\/(login|register|refresh|logout)/.test(reqUrl);

    // If access token expired/invalid -> refresh using refreshToken cookie and retry
    if (status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then(() => axiosInstance(originalRequest));
      }

      isRefreshing = true;
      try {
        const refreshRes = await axiosInstance.post("/auth/refresh");
        const newToken = refreshRes?.data?.accessToken as string | undefined;
        if (!newToken) throw new Error("No accessToken returned from /auth/refresh");

        setAccessToken(newToken);
        processQueue();
        return axiosInstance(originalRequest);
      } catch (e) {
        processQueue(e);
        setAccessToken(null);
        // Inform the app to clear Redux auth state as well.
        try {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("auth:logout"));
          }
        } catch {
          // ignore
        }
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

