import { expect, test } from "@playwright/test";
import { E2E_USERS, mockApi } from "./fixtures/api";
import { loginAs } from "./helpers/auth";

test.describe("routing", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test("sends anonymous visitors from / to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("blocks /admin without a session", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("sends unknown paths to login", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page).toHaveURL(/\/login/);
  });

  test("blocks a teacher from the admin dashboard", async ({ page }) => {
    await loginAs(page, E2E_USERS.teacher);
    await expect(page).toHaveURL(/\/teacher$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });

  test("blocks an admin from the super-admin dashboard", async ({ page }) => {
    await loginAs(page, E2E_USERS.admin);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/super-admin");
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.getByText("Access denied")).toBeVisible();
  });
});
