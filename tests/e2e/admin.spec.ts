import { expect, test, type Page } from "@playwright/test";

async function signInAsAdmin(page: Page) {
  await page.goto("/login?next=/admin");
  await page.getByLabel("Email").fill(process.env.ADMIN_EMAIL!);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/admin");
}

test("administrator can create a product that then appears in the store", async ({ page }) => {
  await signInAsAdmin(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/admin/products/new");
  const name = `E2E Leather Card Holder ${Date.now()}`;
  await page.getByLabel("Product name").fill(name);
  await page.getByRole("textbox", { name: "SKU", exact: true }).fill(`E2E-${Date.now()}`);
  await page.getByLabel("Category").selectOption({ label: "— Bags & Wallets" });
  await page.getByLabel("Full description").fill("Slim full-grain leather card holder.");
  await page.getByLabel("Selling price (৳)").fill("1350");
  await page.getByLabel("Opening stock").fill("8");
  await page.getByRole("combobox", { name: "Product status" }).selectOption("ACTIVE");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText("Product created.")).toBeVisible();

  await page.goto(`/search?q=${encodeURIComponent("E2E Leather Card Holder")}`);
  await expect(page.getByRole("link", { name }).first()).toBeVisible();
});

test("administrator can confirm an order and the history records it", async ({ page, context }) => {
  // Place an order as a guest in a separate page.
  const shopper = await context.newPage();
  await shopper.goto("/product/akr-polarized-aviator-sunglasses");
  await shopper.getByRole("button", { name: "Add to cart" }).click();
  await expect(shopper.getByText(/was added to your cart/)).toBeVisible();
  await shopper.goto("/checkout");
  await shopper.getByLabel("Mobile number").fill("01922222222");
  await shopper.getByLabel("Full name").fill("Admin Flow Customer");
  await shopper.getByLabel("District").selectOption("Sylhet");
  await shopper.getByLabel("City / area").fill("Zindabazar");
  await shopper.getByLabel("Full address").fill("Road 3, Zindabazar");
  await expect(shopper.getByText("Delivery — Outside Dhaka")).toBeVisible();
  await shopper.getByRole("checkbox", { name: /I agree to the/ }).check();
  await shopper.getByRole("button", { name: /Place order/ }).click();
  await expect(shopper.getByRole("heading", { name: "Thank you for your order!" })).toBeVisible();
  const orderNumber = (await shopper.locator("p.font-mono").first().textContent())?.trim() ?? "";
  await shopper.close();

  await signInAsAdmin(page);
  await page.goto(`/admin/orders?q=${orderNumber}`);
  await page.getByRole("link", { name: orderNumber }).click();
  await expect(page.getByRole("heading", { name: `Order ${orderNumber}` })).toBeVisible();
  await page.getByLabel("Move order to").selectOption("CONFIRMED");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Order status updated.")).toBeVisible();
  await expect(page.getByText("Pending → Confirmed")).toBeVisible();
});
