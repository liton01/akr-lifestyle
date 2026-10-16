import { z } from "zod";
import { canonicalDistrict } from "@/lib/constants";
import { bdPhoneSchema, checkboxSchema, optionalEmailSchema, optionalTextSchema } from "@/lib/validation/common";

export const districtSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const district = canonicalDistrict(value);
    if (!district) {
      ctx.addIssue({ code: "custom", message: "Choose your district." });
      return z.NEVER;
    }
    return district;
  });

const postalCodeSchema = optionalTextSchema(10).refine((value) => value === null || /^\d{4}$/.test(value), {
  message: "Postal code must be 4 digits.",
});

export const addressSchema = z.object({
  label: optionalTextSchema(40),
  fullName: z.string().trim().min(2, "Enter the recipient's full name.").max(100),
  phone: bdPhoneSchema,
  district: districtSchema,
  area: z.string().trim().min(2, "Enter your city or area.").max(100),
  addressLine: z.string().trim().min(5, "Enter the full delivery address.").max(300),
  postalCode: postalCodeSchema,
  isDefault: checkboxSchema,
});
export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutSchema = z
  .object({
    idempotencyKey: z.string().uuid("Invalid checkout session. Please refresh the page."),
    fullName: z.string().trim().min(2, "Enter your full name.").max(100),
    phone: bdPhoneSchema,
    email: optionalEmailSchema,
    district: districtSchema,
    area: z.string().trim().min(2, "Enter your city or area.").max(100),
    addressLine: z.string().trim().min(5, "Enter your full delivery address.").max(300),
    postalCode: postalCodeSchema,
    deliveryInstructions: optionalTextSchema(500),
    billingSameAsShipping: checkboxSchema,
    billingFullName: optionalTextSchema(100),
    billingPhone: optionalTextSchema(20),
    billingAddressLine: optionalTextSchema(300),
    billingDistrict: optionalTextSchema(40),
    paymentMethod: z.enum(["COD", "SSLCOMMERZ"], { message: "Choose a payment method." }),
    couponCode: optionalTextSchema(40).transform((value) => (value ? value.toUpperCase() : null)),
    saveAddress: checkboxSchema,
    expectedTotal: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .transform((value) => (value === null || value === undefined || value === "" ? null : Number(value)))
      .refine((value) => value === null || Number.isSafeInteger(value), { message: "Invalid total." })
      .default(null),
    acceptTerms: checkboxSchema.refine((v) => v, { message: "Please accept the terms and conditions." }),
  })
  .superRefine((value, ctx) => {
    if (value.paymentMethod === "SSLCOMMERZ" && !value.email) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Email is required for online payment receipts." });
    }
    if (!value.billingSameAsShipping) {
      if (!value.billingFullName) ctx.addIssue({ code: "custom", path: ["billingFullName"], message: "Enter the billing name." });
      if (!value.billingAddressLine) ctx.addIssue({ code: "custom", path: ["billingAddressLine"], message: "Enter the billing address." });
      if (!value.billingDistrict || !canonicalDistrict(value.billingDistrict)) {
        ctx.addIssue({ code: "custom", path: ["billingDistrict"], message: "Choose the billing district." });
      }
    }
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const trackOrderSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, "Enter your order number.")
    .max(30)
    .regex(/^[A-Z0-9-]+$/, "Enter a valid order number."),
  phone: bdPhoneSchema,
});

export const returnRequestSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(5, "Tell us why you are returning the items.").max(1000),
  items: z
    .array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().min(1).max(1000) }))
    .min(1, "Choose at least one item to return."),
});
