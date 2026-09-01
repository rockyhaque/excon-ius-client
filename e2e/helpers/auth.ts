import type { Page } from "@playwright/test";
import { E2E_PASSWORD, type E2EUser } from "../fixtures/api";

export async function loginAs(page: Page, user: E2EUser, password = E2E_PASSWORD) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter your email").fill(user.email);
  await page.getByPlaceholder("Enter your password").fill(password);
  const loginRequest = page.waitForRequest(
    (req) => req.method() === "POST" && req.url().includes("/auth/login"),
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  await loginRequest;
}
