import { test, expect } from "@playwright/test";

test("app loads and shows token dialog when unauthenticated", async ({
  page,
}) => {
  await page.goto("/");

  // The token dialog should appear since we have no token
  await expect(page.getByText("ArgoCD Authentication")).toBeVisible();
  await expect(page.getByPlaceholder("auth-token")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
});

test("app shows header with title", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("ArgoCD Monitor")).toBeVisible();
});
