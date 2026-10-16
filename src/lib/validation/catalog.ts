import { z } from "zod";
import {
  checkboxSchema,
  idSchema,
  intSchema,
  linkSchema,
  moneySchema,
  optionalDateSchema,
  optionalIdSchema,
  optionalIntSchema,
  optionalMoneySchema,
  optionalTextSchema,
  skuSchema,
  slugSchema,
} from "@/lib/validation/common";

const decimalDimension = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const text = String(value).trim();
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(text)) {
      ctx.addIssue({ code: "custom", message: "Enter a positive number (up to 2 decimals)." });
      return z.NEVER;
    }
    return text;
  })
  .default(null);

export const productImageInputSchema = z.object({
  url: linkSchema.refine((v) => v !== "", "Image URL is required."),
  storageKey: optionalTextSchema(300),
  alt: optionalTextSchema(160),
  width: optionalIntSchema(1, 20_000),
  height: optionalIntSchema(1, 20_000),
});

export const variantOptionInputSchema = z.object({
  attributeId: idSchema,
  valueId: idSchema,
});

export const variantInputSchema = z
  .object({
    id: optionalIdSchema,
    sku: skuSchema,
    barcode: optionalTextSchema(64),
    price: optionalMoneySchema,
    compareAtPrice: optionalMoneySchema,
    salePrice: optionalMoneySchema,
    costPrice: optionalMoneySchema,
    weightGrams: optionalIntSchema(0, 1_000_000),
    isActive: checkboxSchema,
    /** Only used when the variant is created. Later changes go through inventory adjustments. */
    initialStock: optionalIntSchema(0, 1_000_000),
    options: z.array(variantOptionInputSchema).max(5),
  })
  .superRefine((variant, ctx) => {
    if (variant.price === null && (variant.salePrice !== null || variant.compareAtPrice !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Set the variant price before setting its sale or original price.",
      });
    }
    if (variant.price !== null && variant.salePrice !== null && variant.salePrice >= variant.price) {
      ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Sale price must be lower than the price." });
    }
    if (variant.price !== null && variant.compareAtPrice !== null && variant.compareAtPrice < variant.price) {
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "Original price cannot be lower than the selling price." });
    }
  });

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required.").max(160),
    slug: z.union([slugSchema, z.literal("")]).optional(),
    sku: skuSchema,
    barcode: optionalTextSchema(64),
    shortDescription: optionalTextSchema(300),
    description: z.string().trim().min(1, "Description is required.").max(20_000),
    categoryId: idSchema,
    brandId: optionalIdSchema,
    productType: optionalTextSchema(60),
    price: moneySchema,
    compareAtPrice: optionalMoneySchema,
    costPrice: optionalMoneySchema,
    salePrice: optionalMoneySchema,
    saleStartsAt: optionalDateSchema,
    saleEndsAt: optionalDateSchema,
    lowStockThreshold: intSchema(0, 100_000),
    weightGrams: optionalIntSchema(0, 1_000_000),
    lengthCm: decimalDimension,
    widthCm: decimalDimension,
    heightCm: decimalDimension,
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    isFeatured: checkboxSchema,
    isNewArrival: checkboxSchema,
    isBestSeller: checkboxSchema,
    seoTitle: optionalTextSchema(70),
    seoDescription: optionalTextSchema(170),
    specifications: z
      .array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(300) }))
      .max(40)
      .default([]),
    images: z.array(productImageInputSchema).max(12).default([]),
    hasVariants: checkboxSchema,
    /** Initial stock for a simple product (create only). */
    stock: optionalIntSchema(0, 1_000_000),
    variants: z.array(variantInputSchema).max(100).default([]),
  })
  .superRefine((product, ctx) => {
    if (product.salePrice !== null && product.salePrice >= product.price) {
      ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Sale price must be lower than the selling price." });
    }
    if (product.compareAtPrice !== null && product.compareAtPrice < product.price) {
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "Original price cannot be lower than the selling price." });
    }
    if (product.saleStartsAt && product.saleEndsAt && product.saleEndsAt <= product.saleStartsAt) {
      ctx.addIssue({ code: "custom", path: ["saleEndsAt"], message: "Sale end must be after the sale start." });
    }
    if ((product.saleStartsAt || product.saleEndsAt) && product.salePrice === null && !product.hasVariants) {
      ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Set a sale price for the scheduled sale." });
    }
    if (product.hasVariants) {
      if (product.variants.length === 0) {
        ctx.addIssue({ code: "custom", path: ["variants"], message: "Add at least one variant." });
        return;
      }
      const skus = new Set<string>();
      const combos = new Set<string>();
      const attributeSet = (v: (typeof product.variants)[number]) =>
        v.options
          .map((o) => o.attributeId)
          .sort()
          .join("|");
      const expectedAttributes = attributeSet(product.variants[0]!);
      product.variants.forEach((variant, index) => {
        if (variant.options.length === 0) {
          ctx.addIssue({ code: "custom", path: ["variants", index, "options"], message: "Choose the variant's options." });
        }
        if (attributeSet(variant) !== expectedAttributes) {
          ctx.addIssue({ code: "custom", path: ["variants", index, "options"], message: "Every variant must use the same attributes." });
        }
        if (new Set(variant.options.map((o) => o.attributeId)).size !== variant.options.length) {
          ctx.addIssue({ code: "custom", path: ["variants", index, "options"], message: "Each attribute can be used once per variant." });
        }
        if (skus.has(variant.sku)) {
          ctx.addIssue({ code: "custom", path: ["variants", index, "sku"], message: "Variant SKUs must be unique." });
        }
        skus.add(variant.sku);
        const combo = variant.options
          .map((o) => `${o.attributeId}:${o.valueId}`)
          .sort()
          .join("|");
        if (combos.has(combo)) {
          ctx.addIssue({ code: "custom", path: ["variants", index, "options"], message: "Two variants have the same options." });
        }
        combos.add(combo);
      });
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(80),
  slug: z.union([slugSchema, z.literal("")]).optional(),
  description: optionalTextSchema(1000),
  imageUrl: linkSchema.optional().default(""),
  parentId: optionalIdSchema,
  sortOrder: intSchema(-10_000, 10_000),
  isActive: checkboxSchema,
  seoTitle: optionalTextSchema(70),
  seoDescription: optionalTextSchema(170),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const brandInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  slug: z.union([slugSchema, z.literal("")]).optional(),
  description: optionalTextSchema(1000),
  logoUrl: linkSchema.optional().default(""),
  website: linkSchema.optional().default(""),
  sortOrder: intSchema(-10_000, 10_000),
  isActive: checkboxSchema,
});
export type BrandInput = z.infer<typeof brandInputSchema>;

export const attributeInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(60),
  displayType: z.enum(["TEXT", "COLOR"]),
  sortOrder: intSchema(-10_000, 10_000),
});

export const attributeValueInputSchema = z.object({
  attributeId: idSchema,
  value: z.string().trim().min(1, "Value is required.").max(60),
  colorHex: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^#[0-9a-fA-F]{6}$/.test(v), { message: "Use a hex colour like #171717." })
    .default(null),
  sortOrder: intSchema(-10_000, 10_000),
});

export const stockAdjustmentSchema = z.object({
  variantId: idSchema,
  mode: z.enum(["DELTA", "SET"]),
  quantity: intSchema(-1_000_000, 1_000_000),
  reason: z.string().trim().min(3, "Give a reason for the adjustment.").max(300),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
