import { expect, test, type Page } from "@playwright/test";

async function fillCheckout(page: Page, phone: string) {
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByLabel("Full name").fill("E2E Customer");
  await page.getByLabel("District").selectOption("Dhaka");
  await page.getByLabel("City / area").fill("Gulshan");
  await page.getByLabel("Full address").fill("House 1, Road 2, Gulshan 1");
  await expect(page.getByText("Delivery — Inside Dhaka")).toBeVisible();
  await page.getByRole("checkbox", { name: /I agree to the/ }).check();
}

test("guest can browse, add to cart, check out with cash on delivery and track the order", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Gadgets" }).click();
  await expect(page.getByRole("heading", { name: "Gadgets", level: 1 })).toBeVisible();

  await page.goto("/product/voltix-20000mah-power-bank");
  await expect(page.getByRole("heading", { name: /Power Bank/ })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText(/was added to your cart/)).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByRole("link", { name: "Voltix 20,000mAh Fast-Charge Power Bank" })).toBeVisible();
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await fillCheckout(page, "01811111111");
  await page.getByRole("button", { name: /Place order/ }).click();

  await expect(page.getByRole("heading", { name: "Thank you for your order!" })).toBeVisible();
  const orderNumber = (await page.locator("p.font-mono").first().textContent())?.trim() ?? "";
  expect(orderNumber).toMatch(/^AKR\d{6}-[A-Z0-9]{5}$/);

  await page.goto("/track-order");
  await page.getByLabel("Order number").fill(orderNumber);
  await page.getByLabel("Phone number used for the order").fill("01811111111");
  await page.getByRole("button", { name: "Track order" }).click();
  await expect(page.getByText(`Status: Pending`, { exact: false })).toBeVisible();

  // Wrong phone never reveals the order.
  await page.getByLabel("Phone number used for the order").fill("01899999999");
  await page.getByRole("button", { name: "Track order" }).click();
  await expect(page.getByText("We could not find an order")).toBeVisible();
});

test("search suggests products while typing and filters the results page live", async ({ page }) => {
  await page.goto("/");
  const box = page.getByRole("combobox", { name: "Search products" });
  await box.fill("power ba");
  const option = page.getByRole("option", { name: /Voltix 20,000mAh Fast-Charge Power Bank/ });
  await expect(option).toBeVisible();
  await expect(page.getByRole("option", { name: /See all \d+ results? for “power ba”/ })).toBeVisible();
  await box.press("ArrowDown");
  await box.press("Enter");
  await page.waitForURL("**/product/voltix-20000mah-power-bank");

  await page.goto("/search");
  await page.getByLabel("Search products", { exact: true }).last().fill("aurelle");
  await page.waitForURL(/\/search\?q=aurelle/);
  await expect(page.getByRole("heading", { name: "Results for “aurelle”" })).toBeVisible();
  await expect(page.getByText("4 products")).toBeVisible();

  await box.fill("zzqqxx");
  await expect(page.getByText("No products match “zzqqxx”.")).toBeVisible();
});

test("server rejects invalid checkout input and keeps what the customer typed", async ({ page }) => {
  await page.goto("/product/voltix-braided-usb-c-cable-2m");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText(/was added to your cart/)).toBeVisible();
  await page.goto("/checkout");
  await page.getByLabel("Mobile number").fill("12345");
  await page.getByLabel("Full name").fill("Kept Name");
  await page.getByRole("button", { name: /Place order/ }).click();
  // The reason is shown next to the button and the first invalid field gets focus.
  await expect(page.getByRole("alert").filter({ hasText: "Your order was not placed" })).toBeVisible();
  await expect(page.getByText(/valid Bangladeshi mobile number/).first()).toBeVisible();
  await expect(page.getByLabel("Mobile number")).toBeFocused();
  await expect(page.getByLabel("Full name")).toHaveValue("Kept Name");
});

test("customer can register and is kept out of the admin area", async ({ page }) => {
  const email = `e2e-${Date.now()}@test.local`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("E2E Shopper");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("Shopper-Pass-2026");
  await page.getByLabel("Confirm password").fill("Shopper-Pass-2026");
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => url.pathname === "/account");
  await expect(page.getByRole("heading", { name: /Hello, E2E/ })).toBeVisible();

  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin/);
});
