import type { Page, Request, Route } from "@playwright/test";

export type E2EUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "SUPER_ADMIN";
};

export const E2E_PASSWORD = "password123";

export const E2E_USERS = {
  admin: {
    id: "user-admin",
    name: "Admin User",
    email: "admin@example.com",
    role: "ADMIN",
  },
  teacher: {
    id: "user-teacher",
    name: "Sarah Khan",
    email: "sarah.khan@ius.com",
    role: "TEACHER",
  },
  superAdmin: {
    id: "user-super",
    name: "Super Admin",
    email: "superadmin@gmail.com",
    role: "SUPER_ADMIN",
  },
} as const satisfies Record<string, E2EUser>;

function isApiRequest(url: URL) {
  return url.port === "5005" || url.pathname === "/api" || url.pathname.startsWith("/api/");
}

function apiPath(url: URL) {
  const path = (url.pathname.replace(/\/$/, "") || "/").replace(/^\/api/, "") || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function userFromToken(authorization: string | undefined): E2EUser | null {
  const token = authorization?.replace(/^Bearer\s+/i, "") ?? "";
  if (token === `e2e-token-${E2E_USERS.superAdmin.role}`) return E2E_USERS.superAdmin;
  if (token === `e2e-token-${E2E_USERS.teacher.role}`) return E2E_USERS.teacher;
  if (token === `e2e-token-${E2E_USERS.admin.role}`) return E2E_USERS.admin;
  return null;
}

function findUserByEmail(email: string | undefined) {
  return Object.values(E2E_USERS).find((u) => u.email === email);
}

function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": request.headers()["origin"] || "http://localhost:5173",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  };
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    json: body,
    headers: corsHeaders(route.request()),
  });
}

/**
 * Intercepts backend `/api/*` so e2e can run against the Vite app without a live API.
 * Auth is token-based (`e2e-token-<ROLE>`); other GETs return empty lists.
 */
export async function mockApi(page: Page) {
  await page.context().route(
    (url) => isApiRequest(url),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const path = apiPath(url);

      if (method === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders(request) });
        return;
      }

      if (method === "POST" && path === "/auth/login") {
        let body: { email?: string; password?: string } = {};
        try {
          body = request.postDataJSON() as { email?: string; password?: string };
        } catch {
          body = {};
        }
        const user = findUserByEmail(body.email);
        const allowedPasswords = new Set([E2E_PASSWORD, "Excon@2026"]);
        if (!user || !body.password || !allowedPasswords.has(body.password)) {
          await fulfillJson(route, 401, { message: "Invalid credentials" });
          return;
        }
        await fulfillJson(route, 200, { accessToken: `e2e-token-${user.role}`, user });
        return;
      }

      if (method === "GET" && path === "/auth/profile") {
        const user = userFromToken(request.headers()["authorization"]);
        if (!user) {
          await fulfillJson(route, 401, { message: "Unauthorized" });
          return;
        }
        await fulfillJson(route, 200, user);
        return;
      }

      if (method === "POST" && path === "/auth/logout") {
        await fulfillJson(route, 200, { message: "Logged out" });
        return;
      }

      if (method === "POST" && path === "/auth/register") {
        await fulfillJson(route, 400, { message: "Registration is disabled in e2e" });
        return;
      }

      if (method === "GET") {
        if (path === "/allocations/reports") {
          await fulfillJson(route, 200, { stats: {} });
          return;
        }
        await fulfillJson(route, 200, []);
        return;
      }

      await fulfillJson(route, 200, { message: "ok" });
    },
  );
}
