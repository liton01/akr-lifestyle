import { z } from "zod";

/**
 * Store settings are stored per group in the Setting table (key = group name).
 * Every group is validated with these schemas on write, and merged over defaults on read.
 */

/** Relative path ("/shop") or absolute http(s) URL. Blocks javascript:, data:, protocol-relative URLs. */
export const safeLinkSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => {
      if (value === "") return true;
      if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return true;
      try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "Use a path starting with / or a full http(s) URL." },
  );

/** Optional absolute https URL (for social links). */
const httpsUrlOrEmpty = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => {
      if (value === "") return true;
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Use a full https:// URL." },
  );

const isValidTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const generalSettingsSchema = z.object({
  storeName: z.string().trim().min(1).max(80),
  slogan: z.string().trim().max(160),
  logoUrl: safeLinkSchema,
  faviconUrl: safeLinkSchema,
  contactEmail: z.string().trim().email().max(200),
  contactPhone: z.string().trim().max(30),
  whatsappNumber: z.string().trim().max(30),
  businessAddress: z.string().trim().max(400),
  businessHours: z.string().trim().max(200),
  currency: z.literal("BDT"),
  timeZone: z.string().trim().refine(isValidTimeZone, { message: "Unknown time zone." }),
});

export const socialSettingsSchema = z.object({
  facebook: httpsUrlOrEmpty,
  instagram: httpsUrlOrEmpty,
  youtube: httpsUrlOrEmpty,
  tiktok: httpsUrlOrEmpty,
  linkedin: httpsUrlOrEmpty,
});

export const seoSettingsSchema = z.object({
  defaultTitle: z.string().trim().min(1).max(70),
  titleTemplate: z
    .string()
    .trim()
    .max(70)
    .refine((v) => v.includes("%s"), { message: "Template must contain %s." }),
  defaultDescription: z.string().trim().max(170),
  ogImageUrl: safeLinkSchema,
});

export const homepageSettingsSchema = z.object({
  heroEyebrow: z.string().trim().max(60),
  heroTitle: z.string().trim().min(1).max(120),
  heroSubtitle: z.string().trim().max(300),
  heroImageUrl: safeLinkSchema,
  heroPrimaryCtaLabel: z.string().trim().max(40),
  heroPrimaryCtaHref: safeLinkSchema,
  heroSecondaryCtaLabel: z.string().trim().max(40),
  heroSecondaryCtaHref: safeLinkSchema,
  featuredTitle: z.string().trim().max(80),
  newArrivalsTitle: z.string().trim().max(80),
  bestSellersTitle: z.string().trim().max(80),
  trustPoints: z
    .array(z.object({ title: z.string().trim().min(1).max(60), text: z.string().trim().max(160) }))
    .max(6),
});

export const announcementSettingsSchema = z.object({
  enabled: z.boolean(),
  text: z.string().trim().max(160),
  linkUrl: safeLinkSchema,
  linkLabel: z.string().trim().max(40),
});

export const footerSettingsSchema = z.object({
  aboutText: z.string().trim().max(400),
  copyrightText: z.string().trim().max(160),
  links: z
    .array(z.object({ label: z.string().trim().min(1).max(40), href: safeLinkSchema.refine((v) => v !== "", "Link is required.") }))
    .max(16),
});

export const contentSettingsSchema = z.object({
  aboutTitle: z.string().trim().min(1).max(120),
  aboutContent: z.string().trim().max(20_000),
  contactIntro: z.string().trim().max(2_000),
  shippingPolicy: z.string().trim().max(20_000),
  returnPolicy: z.string().trim().max(20_000),
  refundPolicy: z.string().trim().max(20_000),
  privacyPolicy: z.string().trim().max(30_000),
  terms: z.string().trim().max(30_000),
  faqs: z
    .array(z.object({ question: z.string().trim().min(1).max(200), answer: z.string().trim().min(1).max(2_000) }))
    .max(50),
});

export const commerceSettingsSchema = z.object({
  codEnabled: z.boolean(),
  onlinePaymentEnabled: z.boolean(),
  guestCheckoutEnabled: z.boolean(),
  freeDeliveryEnabled: z.boolean(),
  /** Minutes an online-payment order may stay unpaid before it is cancelled and stock released. */
  paymentTimeoutMinutes: z.number().int().min(10).max(1440),
  returnWindowDays: z.number().int().min(0).max(90),
  defaultLowStockThreshold: z.number().int().min(0).max(10_000),
  maxQuantityPerLine: z.number().int().min(1).max(100),
});

export const SETTINGS_SCHEMAS = {
  general: generalSettingsSchema,
  social: socialSettingsSchema,
  seo: seoSettingsSchema,
  homepage: homepageSettingsSchema,
  announcement: announcementSettingsSchema,
  footer: footerSettingsSchema,
  content: contentSettingsSchema,
  commerce: commerceSettingsSchema,
} as const;

export type SettingsGroup = keyof typeof SETTINGS_SCHEMAS;
export type StoreSettings = { [K in SettingsGroup]: z.infer<(typeof SETTINGS_SCHEMAS)[K]> };
export const SETTINGS_GROUPS = Object.keys(SETTINGS_SCHEMAS) as SettingsGroup[];

export function isSettingsGroup(value: string): value is SettingsGroup {
  return (SETTINGS_GROUPS as string[]).includes(value);
}
