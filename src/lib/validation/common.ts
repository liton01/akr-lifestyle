import { z } from "zod";
import { parseMoney } from "@/lib/money";
import { normalizeBdPhone } from "@/lib/utils";

export const idSchema = z.string().trim().min(1).max(64);
export const optionalIdSchema = z
  .string()
  .trim()
  .max(64)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .default(null);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.");

export const skuSchema = z
  .string()
  .trim()
  .min(2, "SKU must be at least 2 characters.")
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/, "SKU may contain letters, numbers, dots, dashes and underscores.")
  .transform((value) => value.toUpperCase());

/** Required money amount in BDT (string or number input) → integer poisha. */
export const moneySchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const minor = parseMoney(String(value));
  if (minor === null || minor < 0) {
    ctx.addIssue({ code: "custom", message: "Enter a valid non-negative amount (up to 2 decimals)." });
    return z.NEVER;
  }
  if (minor > 99_999_999_99) {
    ctx.addIssue({ code: "custom", message: "Amount is too large." });
    return z.NEVER;
  }
  return minor;
});

/** Optional money amount: empty → null. */
export const optionalMoneySchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const minor = parseMoney(String(value));
    if (minor === null || minor < 0) {
      ctx.addIssue({ code: "custom", message: "Enter a valid non-negative amount (up to 2 decimals)." });
      return z.NEVER;
    }
    if (minor > 99_999_999_99) {
      ctx.addIssue({ code: "custom", message: "Amount is too large." });
      return z.NEVER;
    }
    return minor;
  })
  .default(null);

export const optionalIntSchema = (min = 0, max = 1_000_000) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value, ctx) => {
      if (value === null || value === undefined || String(value).trim() === "") return null;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        ctx.addIssue({ code: "custom", message: `Enter a whole number between ${min} and ${max}.` });
        return z.NEVER;
      }
      return parsed;
    })
    .default(null);

export const intSchema = (min = 0, max = 1_000_000) =>
  z.union([z.string(), z.number()]).transform((value, ctx) => {
    const parsed = Number(value);
    if (String(value).trim() === "" || !Number.isInteger(parsed) || parsed < min || parsed > max) {
      ctx.addIssue({ code: "custom", message: `Enter a whole number between ${min} and ${max}.` });
      return z.NEVER;
    }
    return parsed;
  });

/** Datetime-local / ISO input → Date or null. */
export const optionalDateSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (!value || !value.trim()) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time." });
      return z.NEVER;
    }
    return date;
  })
  .default(null);

export const checkboxSchema = z
  .union([z.boolean(), z.string(), z.null(), z.undefined()])
  .transform((value) => value === true || value === "on" || value === "true" || value === "1")
  .default(false);

export const optionalTextSchema = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (value && value.trim() ? value.trim() : null))
    .refine((value) => value === null || value.length <= max, { message: `Must be at most ${max} characters.` })
    .default(null);

export const bdPhoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeBdPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Bangladeshi mobile number, e.g. 01712345678." });
      return z.NEVER;
    }
    return normalized;
  });

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(200);

export const optionalEmailSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (value && value.trim() ? value.trim().toLowerCase() : null))
  .refine((value) => value === null || z.string().email().safeParse(value).success, { message: "Enter a valid email address." })
  .default(null);

/** Relative path or absolute http(s) URL; blocks javascript:/data: and protocol-relative URLs. */
export const linkSchema = z
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

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");
