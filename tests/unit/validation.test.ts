import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SETTINGS_SCHEMAS } from "@/lib/settings-schema";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
import { csvCell } from "@/lib/csv";
import { normalizeBdPhone, safeRedirectPath, slugify } from "@/lib/utils";
import { productInputSchema } from "@/lib/validation/catalog";
import { checkoutSchema } from "@/lib/validation/checkout";

const validCheckout = {
  idempotencyKey: randomUUID(),
  fullName: "Rahim Uddin",
  phone: "+880 1712-345678",
  district: "dhaka",
  area: "Dhanmondi",
  addressLine: "House 5, Road 10",
  paymentMethod: "COD",
  billingSameAsShipping: "on",
  acceptTerms: "on",
};

describe("checkout validation", () => {
  it("normalises phone and district and fills optional fields", () => {
    const parsed = checkoutSchema.parse(validCheckout);
    expect(parsed.phone).toBe("01712345678");
    expect(parsed.district).toBe("Dhaka");
    expect(parsed.email).toBeNull();
    expect(parsed.couponCode).toBeNull();
    expect(parsed.expectedTotal).toBeNull();
  });

  it("rejects invalid phone numbers, unknown districts and missing terms", () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, phone: "12345" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...validCheckout, district: "Atlantis" }).success).toBe(false);
    const { acceptTerms: _ignored, ...withoutTerms } = validCheckout;
    expect(checkoutSchema.safeParse(withoutTerms).success).toBe(false);
  });

  it("requires an email for online payment and billing details when billing differs", () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, paymentMethod: "SSLCOMMERZ" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...validCheckout, paymentMethod: "SSLCOMMERZ", email: "a@b.com" }).success).toBe(true);
    const { billingSameAsShipping: _b, ...billingDiffers } = validCheckout;
    expect(checkoutSchema.safeParse(billingDiffers).success).toBe(false);
  });

  it("ignores client-supplied prices entirely (unknown keys are stripped)", () => {
    const parsed = checkoutSchema.parse({ ...validCheckout, total: "1", unitPrice: "0", discount: "99999" });
    expect(parsed).not.toHaveProperty("total");
    expect(parsed).not.toHaveProperty("unitPrice");
  });
});

const product = {
  name: "Test Watch",
  sku: "tw-1",
  description: "A watch",
  categoryId: "cat",
  price: "1000",
  lowStockThreshold: "5",
  status: "ACTIVE",
};

describe("product validation", () => {
  it("accepts a valid simple product and upper-cases the SKU", () => {
    const parsed = productInputSchema.parse(product);
    expect(parsed.sku).toBe("TW-1");
    expect(parsed.price).toBe(100000);
    expect(parsed.hasVariants).toBe(false);
  });

  it("rejects invalid and negative prices and inverted sale prices", () => {
    expect(productInputSchema.safeParse({ ...product, price: "-5" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...product, price: "12.345" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...product, salePrice: "1200" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...product, compareAtPrice: "900" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...product, stock: "-1" }).success).toBe(false);
  });

  it("rejects duplicate variant SKUs and duplicate option combinations", () => {
    const variant = { sku: "A", isActive: true, options: [{ attributeId: "color", valueId: "black" }] };
    const result = productInputSchema.safeParse({ ...product, hasVariants: true, variants: [variant, { ...variant }] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Variant SKUs must be unique.");
      expect(messages).toContain("Two variants have the same options.");
    }
  });

  it("requires a sale end after the sale start", () => {
    const result = productInputSchema.safeParse({ ...product, salePrice: "900", saleStartsAt: "2026-10-20T00:00:00Z", saleEndsAt: "2026-10-10T00:00:00Z" });
    expect(result.success).toBe(false);
  });
});

describe("settings validation", () => {
  it("accepts the defaults for every group", () => {
    for (const [group, schema] of Object.entries(SETTINGS_SCHEMAS)) {
      expect(schema.safeParse(DEFAULT_SETTINGS[group as keyof typeof DEFAULT_SETTINGS]).success, group).toBe(true);
    }
  });

  it("blocks unsafe links and invalid values", () => {
    const announcement = { ...DEFAULT_SETTINGS.announcement, linkUrl: "javascript:alert(1)" };
    expect(SETTINGS_SCHEMAS.announcement.safeParse(announcement).success).toBe(false);
    expect(SETTINGS_SCHEMAS.announcement.safeParse({ ...announcement, linkUrl: "//evil.example" }).success).toBe(false);
    expect(SETTINGS_SCHEMAS.social.safeParse({ ...DEFAULT_SETTINGS.social, facebook: "http://insecure.example" }).success).toBe(false);
    expect(SETTINGS_SCHEMAS.general.safeParse({ ...DEFAULT_SETTINGS.general, timeZone: "Mars/Olympus" }).success).toBe(false);
    expect(SETTINGS_SCHEMAS.seo.safeParse({ ...DEFAULT_SETTINGS.seo, titleTemplate: "No placeholder" }).success).toBe(false);
  });
});

describe("utilities", () => {
  it("normalises Bangladeshi mobile numbers", () => {
    expect(normalizeBdPhone("01712345678")).toBe("01712345678");
    expect(normalizeBdPhone("+8801712345678")).toBe("01712345678");
    expect(normalizeBdPhone("8801912-345678")).toBe("01912345678");
    expect(normalizeBdPhone("01212345678")).toBeNull();
    expect(normalizeBdPhone("0171234567")).toBeNull();
  });

  it("only allows same-site redirect targets", () => {
    expect(safeRedirectPath("/account")).toBe("/account");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
  });

  it("slugifies and neutralises CSV formulas", () => {
    expect(slugify("Chronos & Co. Meridian")).toBe("chronos-and-co-meridian");
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-12.50")).toBe("-12.50");
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
  });
});
