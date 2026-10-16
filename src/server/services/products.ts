import { Prisma, type PrismaClient, type ProductStatus } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "@/lib/errors";
import { fromMinor, toMinor, toMinorOrNull } from "@/lib/money";
import { can, type Actor } from "@/lib/permissions";
import { productInputSchema, type ProductInput, type VariantInput } from "@/lib/validation/catalog";
import { diffRecords, writeAudit } from "@/server/audit";
import { withTransaction, type Db, type Tx } from "@/server/db";
import { assertPermission } from "@/server/services/authz";
import { loadCategoryIndex } from "@/server/services/categories";
import { uniqueSlug } from "@/server/services/slug";

const money = (minor: number | null) => (minor === null ? null : fromMinor(minor));

type OptionMeta = { valueId: string; attributeId: string; value: string; attributeSort: number; valueSort: number };

async function loadOptionMeta(db: Db, input: ProductInput): Promise<Map<string, OptionMeta>> {
  const valueIds = [...new Set(input.variants.flatMap((v) => v.options.map((o) => o.valueId)))];
  if (valueIds.length === 0) return new Map();
  const values = await db.attributeValue.findMany({
    where: { id: { in: valueIds } },
    select: { id: true, attributeId: true, value: true, sortOrder: true, attribute: { select: { sortOrder: true } } },
  });
  const map = new Map<string, OptionMeta>(
    values.map((v) => [
      v.id,
      { valueId: v.id, attributeId: v.attributeId, value: v.value, attributeSort: v.attribute.sortOrder, valueSort: v.sortOrder },
    ]),
  );
  input.variants.forEach((variant, index) => {
    for (const option of variant.options) {
      const meta = map.get(option.valueId);
      if (!meta || meta.attributeId !== option.attributeId) {
        throw new ValidationError("A variant uses an unknown option value.", { [`variants.${index}.options`]: ["Choose valid options."] });
      }
    }
  });
  return map;
}

function variantLabel(variant: VariantInput, meta: Map<string, OptionMeta>): string {
  const parts = variant.options
    .map((o) => meta.get(o.valueId)!)
    .sort((a, b) => a.attributeSort - b.attributeSort)
    .map((m) => m.value);
  return parts.join(" / ") || "Default";
}

async function assertReferences(db: Db, input: ProductInput) {
  const [category, brand] = await Promise.all([
    db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
    input.brandId ? db.brand.findUnique({ where: { id: input.brandId }, select: { id: true } }) : Promise.resolve({ id: "none" }),
  ]);
  if (!category) throw new ValidationError("Choose a valid category.", { categoryId: ["Category not found."] });
  if (!brand) throw new ValidationError("Choose a valid brand.", { brandId: ["Brand not found."] });
}

async function assertSkusAvailable(db: Db, input: ProductInput, productId: string | null) {
  const productSkuOwner = await db.product.findUnique({ where: { sku: input.sku }, select: { id: true } });
  if (productSkuOwner && productSkuOwner.id !== productId) {
    throw new ValidationError("This SKU is already used by another product.", { sku: ["SKU already in use."] });
  }
  const variantSkus = input.hasVariants ? input.variants.map((v) => v.sku) : [input.sku];
  const conflicts = await db.productVariant.findMany({
    where: { sku: { in: variantSkus }, ...(productId ? { productId: { not: productId } } : {}) },
    select: { sku: true },
  });
  if (conflicts.length > 0) {
    throw new ValidationError(`SKU already used by another product: ${conflicts.map((c) => c.sku).join(", ")}`, {
      variants: ["Variant SKUs must be unique across the catalog."],
    });
  }
}

function productData(input: ProductInput, slug: string, includeCost: boolean) {
  return {
    name: input.name,
    slug,
    sku: input.sku,
    barcode: input.barcode,
    shortDescription: input.shortDescription,
    description: input.description,
    categoryId: input.categoryId,
    brandId: input.brandId,
    productType: input.productType,
    price: fromMinor(input.price),
    compareAtPrice: money(input.compareAtPrice),
    ...(includeCost ? { costPrice: money(input.costPrice) } : {}),
    salePrice: money(input.salePrice),
    saleStartsAt: input.saleStartsAt,
    saleEndsAt: input.saleEndsAt,
    lowStockThreshold: input.lowStockThreshold,
    weightGrams: input.weightGrams,
    lengthCm: input.lengthCm,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
    status: input.status,
    isFeatured: input.isFeatured,
    isNewArrival: input.isNewArrival,
    isBestSeller: input.isBestSeller,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    specifications: input.specifications as Prisma.InputJsonValue,
  };
}

async function createVariantWithStock(
  tx: Tx,
  product: { id: string; name: string },
  data: {
    sku: string;
    barcode: string | null;
    name: string;
    isDefault: boolean;
    isActive: boolean;
    sortOrder: number;
    price: number | null;
    compareAtPrice: number | null;
    salePrice: number | null;
    costPrice?: number | null;
    weightGrams: number | null;
    options: { attributeId: string; valueId: string }[];
  },
  initialStock: number,
  actorId: string,
) {
  const variant = await tx.productVariant.create({
    data: {
      productId: product.id,
      sku: data.sku,
      barcode: data.barcode,
      name: data.name,
      isDefault: data.isDefault,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
      price: money(data.price),
      compareAtPrice: money(data.compareAtPrice),
      salePrice: money(data.salePrice),
      ...(data.costPrice !== undefined ? { costPrice: money(data.costPrice) } : {}),
      weightGrams: data.weightGrams,
      options: { create: data.options.map((o) => ({ attributeId: o.attributeId, attributeValueId: o.valueId })) },
      inventory: { create: { quantity: initialStock } },
    },
  });
  if (initialStock > 0) {
    await tx.inventoryMovement.create({
      data: {
        variantId: variant.id,
        sku: variant.sku,
        productName: product.name,
        type: "INITIAL_STOCK",
        quantityChange: initialStock,
        quantityBefore: 0,
        quantityAfter: initialStock,
        reason: "Initial stock",
        actorId,
        dedupeKey: `variant:${variant.id}:initial`,
      },
    });
  }
  return variant;
}

function translateUniqueError(error: unknown): never {
  if (isUniqueViolation(error, "slug")) throw new ValidationError("This slug is already used by another product.", { slug: ["Choose a different slug."] });
  if (isUniqueViolation(error, "sku")) throw new ValidationError("A SKU is already in use.", { sku: ["SKU already in use."] });
  if (isUniqueViolation(error, "barcode")) throw new ValidationError("A barcode is already in use.", { barcode: ["Barcode already in use."] });
  throw error;
}

export async function createProduct(db: PrismaClient, actor: Actor, raw: unknown) {
  assertPermission(actor, "product:write");
  const input = productInputSchema.parse(raw);
  const includeCost = can(actor.role, "product:view-cost");
  await assertReferences(db, input);
  await assertSkusAvailable(db, input, null);
  const optionMeta = await loadOptionMeta(db, input);
  const slug =
    input.slug ||
    (await uniqueSlug(input.name, async (candidate) => Boolean(await db.product.findUnique({ where: { slug: candidate }, select: { id: true } }))));
  const now = new Date();

  try {
    return await withTransaction(db, async (tx) => {
      const product = await tx.product.create({
        data: {
          ...productData(input, slug, includeCost),
          publishedAt: input.status === "ACTIVE" ? now : null,
          archivedAt: input.status === "ARCHIVED" ? now : null,
          images: {
            create: input.images.map((image, index) => ({
              url: image.url,
              storageKey: image.storageKey,
              alt: image.alt,
              width: image.width,
              height: image.height,
              sortOrder: index,
            })),
          },
        },
      });

      if (!input.hasVariants) {
        await createVariantWithStock(
          tx,
          product,
          {
            sku: input.sku,
            barcode: input.barcode,
            name: "Default",
            isDefault: true,
            isActive: true,
            sortOrder: 0,
            price: null,
            compareAtPrice: null,
            salePrice: null,
            weightGrams: null,
            options: [],
          },
          input.stock ?? 0,
          actor.id,
        );
      } else {
        for (const [index, variant] of input.variants.entries()) {
          await createVariantWithStock(
            tx,
            product,
            {
              sku: variant.sku,
              barcode: variant.barcode,
              name: variantLabel(variant, optionMeta),
              isDefault: false,
              isActive: variant.isActive,
              sortOrder: index,
              price: variant.price,
              compareAtPrice: variant.compareAtPrice,
              salePrice: variant.salePrice,
              ...(includeCost ? { costPrice: variant.costPrice } : {}),
              weightGrams: variant.weightGrams,
              options: variant.options,
            },
            variant.initialStock ?? 0,
            actor.id,
          );
        }
      }

      await writeAudit(tx, actor, {
        action: "product.create",
        entityType: "Product",
        entityId: product.id,
        metadata: { name: product.name, sku: product.sku, status: product.status },
      });
      return product;
    });
  } catch (error) {
    translateUniqueError(error);
  }
}

/** Remove a variant: deactivate when it has order history, otherwise delete it. */
async function retireVariant(tx: Tx, variant: { id: string; _count: { orderItems: number } }) {
  if (variant._count.orderItems > 0) {
    await tx.productVariant.update({ where: { id: variant.id }, data: { isActive: false, isDefault: false } });
    await tx.cartItem.deleteMany({ where: { variantId: variant.id } });
  } else {
    await tx.productVariant.delete({ where: { id: variant.id } });
  }
}

export async function updateProduct(db: PrismaClient, actor: Actor, id: string, raw: unknown) {
  assertPermission(actor, "product:write");
  const input = productInputSchema.parse(raw);
  const includeCost = can(actor.role, "product:view-cost");
  const existing = await db.product.findUnique({
    where: { id },
    include: {
      variants: { include: { options: true, _count: { select: { orderItems: true } } } },
    },
  });
  if (!existing) throw new NotFoundError("Product not found.");
  await assertReferences(db, input);
  await assertSkusAvailable(db, input, id);
  const optionMeta = await loadOptionMeta(db, input);
  const slug =
    input.slug ||
    existing.slug ||
    (await uniqueSlug(input.name, async (candidate) => {
      const owner = await db.product.findUnique({ where: { slug: candidate }, select: { id: true } });
      return Boolean(owner && owner.id !== id);
    }));
  const now = new Date();

  try {
    return await withTransaction(db, async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...productData(input, slug, includeCost),
          publishedAt: input.status === "ACTIVE" ? (existing.publishedAt ?? now) : existing.publishedAt,
          archivedAt: input.status === "ARCHIVED" ? (existing.archivedAt ?? now) : null,
        },
      });

      await tx.productImage.deleteMany({ where: { productId: id } });
      if (input.images.length) {
        await tx.productImage.createMany({
          data: input.images.map((image, index) => ({
            productId: id,
            url: image.url,
            storageKey: image.storageKey,
            alt: image.alt,
            width: image.width,
            height: image.height,
            sortOrder: index,
          })),
        });
      }

      const existingById = new Map(existing.variants.map((v) => [v.id, v]));

      if (!input.hasVariants) {
        const defaultVariant =
          existing.variants.find((v) => v.isDefault) ?? existing.variants.find((v) => v.options.length === 0) ?? null;
        for (const variant of existing.variants) {
          if (variant.id !== defaultVariant?.id) await retireVariant(tx, variant);
        }
        if (defaultVariant) {
          await tx.variantOption.deleteMany({ where: { variantId: defaultVariant.id } });
          await tx.productVariant.update({
            where: { id: defaultVariant.id },
            data: {
              sku: input.sku,
              barcode: input.barcode,
              name: "Default",
              isDefault: true,
              isActive: true,
              sortOrder: 0,
              price: null,
              compareAtPrice: null,
              salePrice: null,
            },
          });
        } else {
          await createVariantWithStock(
            tx,
            updated,
            {
              sku: input.sku,
              barcode: input.barcode,
              name: "Default",
              isDefault: true,
              isActive: true,
              sortOrder: 0,
              price: null,
              compareAtPrice: null,
              salePrice: null,
              weightGrams: null,
              options: [],
            },
            input.stock ?? 0,
            actor.id,
          );
        }
      } else {
        const keepIds = new Set(input.variants.map((v) => v.id).filter((v): v is string => Boolean(v)));
        for (const keepId of keepIds) {
          if (!existingById.has(keepId)) throw new ValidationError("A variant does not belong to this product.");
        }
        for (const variant of existing.variants) {
          if (!keepIds.has(variant.id)) await retireVariant(tx, variant);
        }
        for (const [index, variant] of input.variants.entries()) {
          const common = {
            sku: variant.sku,
            barcode: variant.barcode,
            name: variantLabel(variant, optionMeta),
            isDefault: false,
            isActive: variant.isActive,
            sortOrder: index,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
            salePrice: variant.salePrice,
            weightGrams: variant.weightGrams,
          };
          if (variant.id) {
            await tx.variantOption.deleteMany({ where: { variantId: variant.id } });
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                ...common,
                price: money(common.price),
                compareAtPrice: money(common.compareAtPrice),
                salePrice: money(common.salePrice),
                ...(includeCost ? { costPrice: money(variant.costPrice) } : {}),
                options: { create: variant.options.map((o) => ({ attributeId: o.attributeId, attributeValueId: o.valueId })) },
              },
            });
          } else {
            await createVariantWithStock(
              tx,
              updated,
              { ...common, ...(includeCost ? { costPrice: variant.costPrice } : {}), options: variant.options },
              variant.initialStock ?? 0,
              actor.id,
            );
          }
        }
      }

      await writeAudit(tx, actor, {
        action: "product.update",
        entityType: "Product",
        entityId: id,
        metadata: diffRecords(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, [
          "updatedAt",
          "costPrice",
          "specifications",
        ]) as Prisma.InputJsonValue,
      });
      return updated;
    });
  } catch (error) {
    translateUniqueError(error);
  }
}

export async function setProductStatus(db: Db, actor: Actor, id: string, status: ProductStatus) {
  assertPermission(actor, "product:write");
  const product = await db.product.findUnique({ where: { id }, select: { id: true, status: true, publishedAt: true, name: true } });
  if (!product) throw new NotFoundError("Product not found.");
  const now = new Date();
  const updated = await db.product.update({
    where: { id },
    data: {
      status,
      publishedAt: status === "ACTIVE" ? (product.publishedAt ?? now) : product.publishedAt,
      archivedAt: status === "ARCHIVED" ? now : null,
    },
  });
  await writeAudit(db, actor, {
    action: status === "ARCHIVED" ? "product.archive" : product.status === "ARCHIVED" ? "product.restore" : "product.status",
    entityType: "Product",
    entityId: id,
    metadata: { from: product.status, to: status },
  });
  return updated;
}

/** Hard delete — only for products that were never ordered. Otherwise archive. */
export async function deleteProduct(db: Db, actor: Actor, id: string) {
  assertPermission(actor, "product:delete");
  const product = await db.product.findUnique({ where: { id }, select: { id: true, name: true, sku: true } });
  if (!product) throw new NotFoundError("Product not found.");
  const ordered = await db.orderItem.count({ where: { OR: [{ productId: id }, { variant: { productId: id } }] } });
  if (ordered > 0) {
    throw new ConflictError("This product has order history and cannot be deleted. Archive it instead.");
  }
  await db.product.delete({ where: { id } });
  await writeAudit(db, actor, { action: "product.delete", entityType: "Product", entityId: id, metadata: { name: product.name, sku: product.sku } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin queries
// ─────────────────────────────────────────────────────────────────────────────

export type AdminProductSort = "updated" | "newest" | "name" | "price-asc" | "price-desc" | "sold";

export async function listAdminProducts(
  db: Db,
  options: {
    q?: string;
    status?: ProductStatus;
    categoryId?: string;
    brandId?: string;
    flag?: "featured" | "new" | "bestseller";
    sort?: AdminProductSort;
    page: number;
    pageSize: number;
  },
) {
  const categoryIds = options.categoryId ? (await loadCategoryIndex(db)).descendants(options.categoryId) : null;
  const where: Prisma.ProductWhereInput = {
    ...(options.status ? { status: options.status } : {}),
    ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    ...(options.brandId ? { brandId: options.brandId } : {}),
    ...(options.flag === "featured" ? { isFeatured: true } : {}),
    ...(options.flag === "new" ? { isNewArrival: true } : {}),
    ...(options.flag === "bestseller" ? { isBestSeller: true } : {}),
    ...(options.q
      ? {
          OR: [
            { name: { contains: options.q, mode: "insensitive" } },
            { sku: { contains: options.q, mode: "insensitive" } },
            { barcode: { contains: options.q, mode: "insensitive" } },
            { variants: { some: { sku: { contains: options.q, mode: "insensitive" } } } },
            { brand: { name: { contains: options.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    options.sort === "name"
      ? [{ name: "asc" }]
      : options.sort === "newest"
        ? [{ createdAt: "desc" }]
        : options.sort === "price-asc"
          ? [{ price: "asc" }]
          : options.sort === "price-desc"
            ? [{ price: "desc" }]
            : options.sort === "sold"
              ? [{ soldCount: "desc" }]
              : [{ updatedAt: "desc" }];

  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [...orderBy, { id: "asc" }],
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        status: true,
        price: true,
        salePrice: true,
        saleStartsAt: true,
        saleEndsAt: true,
        isFeatured: true,
        isNewArrival: true,
        isBestSeller: true,
        soldCount: true,
        lowStockThreshold: true,
        updatedAt: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        variants: { where: { isActive: true }, select: { id: true, inventory: { select: { quantity: true } } } },
      },
    }),
    db.product.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      status: p.status,
      price: toMinor(p.price),
      salePrice: toMinorOrNull(p.salePrice),
      isFeatured: p.isFeatured,
      isNewArrival: p.isNewArrival,
      isBestSeller: p.isBestSeller,
      soldCount: p.soldCount,
      lowStockThreshold: p.lowStockThreshold,
      updatedAt: p.updatedAt,
      categoryName: p.category.name,
      brandName: p.brand?.name ?? null,
      imageUrl: p.images[0]?.url ?? null,
      variantCount: p.variants.length,
      stock: p.variants.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0),
    })),
  };
}

export type ProductFormValues = {
  id: string | null;
  name: string;
  slug: string;
  sku: string;
  barcode: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  brandId: string;
  productType: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  salePrice: string;
  saleStartsAt: string;
  saleEndsAt: string;
  lowStockThreshold: string;
  weightGrams: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  status: ProductStatus;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  seoTitle: string;
  seoDescription: string;
  specifications: { label: string; value: string }[];
  images: { url: string; storageKey: string | null; alt: string; width: number | null; height: number | null }[];
  hasVariants: boolean;
  stock: string;
  currentStock: number | null;
  variants: {
    id: string | null;
    sku: string;
    barcode: string;
    price: string;
    compareAtPrice: string;
    salePrice: string;
    costPrice: string;
    weightGrams: string;
    isActive: boolean;
    initialStock: string;
    currentStock: number | null;
    options: { attributeId: string; valueId: string }[];
  }[];
};

const minorToForm = (value: Prisma.Decimal | null | undefined) => {
  if (value === null || value === undefined) return "";
  const text = fromMinor(toMinor(value));
  return text.endsWith(".00") ? text.slice(0, -3) : text;
};

export async function getProductFormValues(db: Db, id: string, includeCost: boolean): Promise<ProductFormValues | null> {
  const product = await db.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      // Inactive variants are included so that deactivating a variant never deletes it on the next save.
      variants: {
        orderBy: { sortOrder: "asc" },
        include: { options: true, inventory: { select: { quantity: true } } },
      },
    },
  });
  if (!product) return null;
  const defaultVariant = product.variants.find((v) => v.isDefault);
  const hasVariants = !defaultVariant && product.variants.some((v) => v.options.length > 0);
  const specs = Array.isArray(product.specifications) ? (product.specifications as { label: string; value: string }[]) : [];
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    barcode: product.barcode ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description,
    categoryId: product.categoryId,
    brandId: product.brandId ?? "",
    productType: product.productType ?? "",
    price: minorToForm(product.price),
    compareAtPrice: minorToForm(product.compareAtPrice),
    costPrice: includeCost ? minorToForm(product.costPrice) : "",
    salePrice: minorToForm(product.salePrice),
    saleStartsAt: product.saleStartsAt?.toISOString() ?? "",
    saleEndsAt: product.saleEndsAt?.toISOString() ?? "",
    lowStockThreshold: String(product.lowStockThreshold),
    weightGrams: product.weightGrams?.toString() ?? "",
    lengthCm: product.lengthCm?.toString() ?? "",
    widthCm: product.widthCm?.toString() ?? "",
    heightCm: product.heightCm?.toString() ?? "",
    status: product.status,
    isFeatured: product.isFeatured,
    isNewArrival: product.isNewArrival,
    isBestSeller: product.isBestSeller,
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    specifications: specs,
    images: product.images.map((image) => ({
      url: image.url,
      storageKey: image.storageKey,
      alt: image.alt ?? "",
      width: image.width,
      height: image.height,
    })),
    hasVariants,
    stock: "",
    currentStock: defaultVariant?.inventory?.quantity ?? null,
    variants: hasVariants
      ? product.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          barcode: variant.barcode ?? "",
          price: minorToForm(variant.price),
          compareAtPrice: minorToForm(variant.compareAtPrice),
          salePrice: minorToForm(variant.salePrice),
          costPrice: includeCost ? minorToForm(variant.costPrice) : "",
          weightGrams: variant.weightGrams?.toString() ?? "",
          isActive: variant.isActive,
          initialStock: "",
          currentStock: variant.inventory?.quantity ?? 0,
          options: variant.options.map((o) => ({ attributeId: o.attributeId, valueId: o.attributeValueId })),
        }))
      : [],
  };
}
