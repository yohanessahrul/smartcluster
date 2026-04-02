import { expect, test } from "@playwright/test";

test.describe("Smart Cluster public flow", () => {
  test("landing page renders key content", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Smart Cluster").first()).toBeVisible();
    await expect(page.getByText("Sistem Manajemen Transaksi & IPL")).toBeVisible();
  });

  test("login page renders google login button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Masuk ke Dashboard" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Login dengan Google" })).toBeVisible();
  });
});
