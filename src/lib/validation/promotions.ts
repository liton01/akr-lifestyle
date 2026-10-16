import { z } from "zod";
import {
  checkboxSchema,
  idSchema,
  intSchema,
  linkSchema,
  moneySchema,
  optionalDateSchema,
  optionalIntSchema,
  optionalMoneySchema,
  optionalTextSchema,
} from "@/lib/validation/common";

const idList = z
  .union([z.array(idSchema), idSchema, z.undefined(), z.null()])
  .transform((value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]))
  .default([]);

function refineValue(type: "PERCENTAGE" | "FIXED_AMOUNT", value: number, ctx: z.RefinementCtx) {
  if (value <= 0) ctx.addIssue({ code: "custom", path: ["value"], message: "Value must be greater than zero." });
  if (type === "PERCENTAGE" && value > 100_00) ctx.addIssue({ code: "custom", path: ["value"], message: "Percentage cannot exceed 100." });
}

export const discountInputSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required.").max(100),
    description: optionalTextSchema(500),
    type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    /** Percentage (e.g. 12.5) or BDT amount — both parsed as 2-decimal fixed point. */
    value: moneySchema,
    scope: z.enum(["STORE_WIDE", "PRODUCT", "CATEGORY", "BRAND"]),
    maxDiscountAmount: optionalMoneySchema,
    badgeLabel: optionalTextSchema(30),
    startsAt: optionalDateSchema,
    endsAt: optionalDateSchema,
    isActive: checkboxSchema,
    productIds: idList,
    categoryIds: idList,
    brandIds: idList,
  })
  .superRefine((d, ctx) => {
    refineValue(d.type, d.value, ctx);
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start." });
    if (d.scope === "PRODUCT" && d.productIds.length === 0) ctx.addIssue({ code: "custom", path: ["productIds"], message: "Choose at least one product." });
    if (d.scope === "CATEGORY" && d.categoryIds.length === 0) ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "Choose at least one category." });
    if (d.scope === "BRAND" && d.brandIds.length === 0) ctx.addIssue({ code: "custom", path: ["brandIds"], message: "Choose at least one brand." });
  });
export type DiscountInput = z.infer<typeof discountInputSchema>;

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Code must be at least 3 characters.")
      .max(32)
      .regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, dashes or underscores."),
    description: optionalTextSchema(300),
    type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    value: moneySchema,
    scope: z.enum(["ORDER", "PRODUCT", "CATEGORY"]),
    minOrderAmount: optionalMoneySchema,
    maxDiscountAmount: optionalMoneySchema,
    startsAt: optionalDateSchema,
    endsAt: optionalDateSchema,
    isActive: checkboxSchema,
    usageLimit: optionalIntSchema(1, 1_000_000),
    perCustomerLimit: optionalIntSchema(1, 1000),
    newCustomersOnly: checkboxSchema,
    appliesToSaleItems: checkboxSchema,
    productIds: idList,
    categoryIds: idList,
  })
  .superRefine((c, ctx) => {
    refineValue(c.type, c.value, ctx);
    if (c.startsAt && c.endsAt && c.endsAt <= c.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start." });
    if (c.scope === "PRODUCT" && c.productIds.length === 0) ctx.addIssue({ code: "custom", path: ["productIds"], message: "Choose at least one product." });
    if (c.scope === "CATEGORY" && c.categoryIds.length === 0) ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "Choose at least one category." });
  });
export type CouponInput = z.infer<typeof couponInputSchema>;

export const bannerInputSchema = z
  .object({
    eyebrow: optionalTextSchema(60),
    title: z.string().trim().min(2, "Title is required.").max(120),
    subtitle: optionalTextSchema(300),
    imageUrl: linkSchema.refine((v) => v !== "", "Upload or enter an image."),
    mobileImageUrl: linkSchema.optional().default(""),
    linkUrl: linkSchema.optional().default(""),
    ctaLabel: optionalTextSchema(40),
    secondaryCtaLabel: optionalTextSchema(40),
    secondaryLinkUrl: linkSchema.optional().default(""),
    textTone: z.enum(["LIGHT", "DARK"]).default("LIGHT"),
    placement: z.enum(["HOME_HERO", "HOME_PROMO", "HOME_STRIP", "OFFERS_PAGE"]),
    sortOrder: intSchema(-10_000, 10_000),
    isActive: checkboxSchema,
    startsAt: optionalDateSchema,
    endsAt: optionalDateSchema,
  })
  .superRefine((b, ctx) => {
    if (b.startsAt && b.endsAt && b.endsAt <= b.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start." });
    if (b.secondaryCtaLabel && !b.secondaryLinkUrl) ctx.addIssue({ code: "custom", path: ["secondaryLinkUrl"], message: "Add a link for the second button." });
  });
export type BannerInput = z.infer<typeof bannerInputSchema>;

export const deliveryZoneInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(80),
  districts: z
    .union([z.array(z.string()), z.string(), z.undefined()])
    .transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]).map((d) => d.trim()).filter(Boolean))
    .default([]),
  fee: moneySchema,
  freeDeliveryThreshold: optionalMoneySchema,
  estimatedDays: optionalTextSchema(60),
  isDefault: checkboxSchema,
  isActive: checkboxSchema,
  sortOrder: intSchema(-10_000, 10_000),
});
export type DeliveryZoneInput = z.infer<typeof deliveryZoneInputSchema>;
