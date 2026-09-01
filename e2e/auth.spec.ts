import { expect, test } from "@playwright/test";
import { E2E_USERS, mockApi } from "./fixtures/api";
import { loginAs } from "./helpers/auth";

test.describe("auth", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test("shows the login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("fills demo admin credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await expect(page.getByPlaceholder("Enter your email")).toHaveValue(E2E_USERS.admin.email);
    await expect(page.getByPlaceholder("Enter your password")).toHaveValue("Excon@2026");
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await loginAs(page, E2E_USERS.admin, "wrong-password");
    await expect(page.locator(".auth__error")).toHaveText("Invalid credentials");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs admin in and lands on the admin dashboard", async ({ page }) => {
    await loginAs(page, E2E_USERS.admin);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("complementary", { name: "Admin sidebar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin Overview" })).toBeVisible();
  });

  test("logs teacher in and lands on the teacher dashboard", async ({ page }) => {
    await loginAs(page, E2E_USERS.teacher);
    await expect(page).toHaveURL(/\/teacher$/);
    await expect(page.getByRole("complementary", { name: "Teacher sidebar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Teacher overview" })).toBeVisible();
  });

  test("logs super admin in and lands on the super-admin dashboard", async ({ page }) => {
    await loginAs(page, E2E_USERS.superAdmin);
    await expect(page).toHaveURL(/\/super-admin$/);
    await expect(page.getByRole("complementary", { name: "Super Admin sidebar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Super Admin Overview" })).toBeVisible();
  });

  test("logs out back to login", async ({ page }) => {
    await loginAs(page, E2E_USERS.admin);
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Welcome back!" })).toBeVisible();
  });

  test("opens register from the login footer", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  });
});
