import { Prisma } from "@prisma/client";
import { resolveUnitPrice, type UnitPrice } from "@/lib/pricing/engine";
import { prisma, type Db } from "@/server/db";
import { stockState } from "@/server/services/inventory";
import {
  loadPricingContext,
  productPriceSelect,
  toPricingProduct,
  toPricingVariant,
  variantPriceSelect,
  type LoadedPricingContext,
} from "@/server/services/pricing";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  brandName: string | null;
  categoryName: string;
  /** Gallery images in display order (at most CARD_IMAGE_LIMIT); cards with several auto-slide. */
  images: { url: string; alt: string }[];
  price: UnitPrice;
  /** True when variants have different prices, so "From" is shown. */
  priceFrom: boolean;
  inStock: boolean;
  lowStock: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  /** Set when the product can be added to the cart without choosing options. */
  quickAddVariantId: string | null;
};

/** How many gallery images a product card can cycle through. */
export const CARD_IMAGE_LIMIT = 4;

const cardSelect = {
  ...productPriceSelect,
  slug: true,
  name: true,
  isNewArrival: true,
  isBestSeller: true,
  lowStockThreshold: true,
  brand: { select: { name: true } },
  category: { select: { name: true } },
  images: { select: { url: true, alt: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: CARD_IMAGE_LIMIT },
  variants: {
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      ...variantPriceSelect,
      isDefault: true,
      _count: { select: { options: true } },
      inventory: { select: { quantity: true, lowStockThreshold: true } },
    },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

export function toProductCard(row: CardRow, ctx: LoadedPricingContext): ProductCardData {
  const product = toPricingProduct(row);
  const prices = row.variants.map((v) => ({ variant: v, price: resolveUnitPrice(product, toPricingVariant(v), ctx) }));
  const inStockVariants = prices.filter((p) => (p.variant.inventory?.quantity ?? 0) > 0);
  const pool = inStockVariants.length ? inStockVariants : prices;
  const cheapest = pool.reduce<(typeof prices)[number] | null>((best, p) => (!best || p.price.finalPrice < best.price.finalPrice ? p : best), null);
  const price = cheapest?.price ?? resolveUnitPrice(product, null, ctx);
  const distinct = new Set(prices.map((p) => p.price.finalPrice));
  const totalStock = row.variants.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0);
  const single = row.variants.length === 1 ? row.variants[0]! : null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brandName: row.brand?.name ?? null,
    categoryName: row.category.name,
    images: row.images.map((image) => ({ url: image.url, alt: image.alt || row.name })),
    price,
    priceFrom: distinct.size > 1,
    inStock: totalStock > 0,
    lowStock: totalStock > 0 && stockState(totalStock, row.lowStockThreshold) === "low",
    isNewArrival: row.isNewArrival,
    isBestSeller: row.isBestSeller,
    quickAddVariantId: single && single._count.options === 0 && (single.inventory?.quantity ?? 0) > 0 ? single.id : null,
  };
}

export type CatalogSort = "featured" | "newest" | "price-asc" | "price-desc" | "popular" | "name";

export type CatalogQuery = {
  q?: string;
  categoryId?: string;
  brandIds?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  inStock?: boolean;
  onSale?: boolean;
  flag?: "featured" | "new" | "bestseller";
  sort?: CatalogSort;
  page: number;
  pageSize: number;
};

/** Build the product filter. Price filters/sorting use the regular selling price. */
export function buildCatalogWhere(query: CatalogQuery, ctx: LoadedPricingContext): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ status: "ACTIVE" }, { variants: { some: { isActive: true } } }, { category: { isActive: true } }];

  if (query.q) {
    const terms = query.q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
    for (const term of terms) {
      and.push({
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { sku: { contains: term, mode: "insensitive" } },
          { variants: { some: { sku: { contains: term, mode: "insensitive" } } } },
          { brand: { name: { contains: term, mode: "insensitive" } } },
          { category: { name: { contains: term, mode: "insensitive" } } },
          { productType: { contains: term, mode: "insensitive" } },
          { shortDescription: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
        ],
      });
    }
  }
  if (query.categoryId) and.push({ categoryId: { in: ctx.categories.descendants(query.categoryId) } });
  if (query.brandIds?.length) and.push({ brandId: { in: query.brandIds } });
  if (query.minPrice !== null && query.minPrice !== undefined) and.push({ price: { gte: new Prisma.Decimal(query.minPrice).div(100) } });
  if (query.maxPrice !== null && query.maxPrice !== undefined) and.push({ price: { lte: new Prisma.Decimal(query.maxPrice).div(100) } });
  if (query.inStock) and.push({ variants: { some: { isActive: true, inventory: { quantity: { gt: 0 } } } } });
  if (query.flag === "featured") and.push({ isFeatured: true });
  if (query.flag === "new") and.push({ isNewArrival: true });
  if (query.flag === "bestseller") and.push({ isBestSeller: true });

  if (query.onSale) {
    const now = ctx.now;
    const saleWindow: Prisma.ProductWhereInput = {
      AND: [{ OR: [{ saleStartsAt: null }, { saleStartsAt: { lte: now } }] }, { OR: [{ saleEndsAt: null }, { saleEndsAt: { gt: now } }] }],
    };
    const storeWide = ctx.discounts.some((d) => d.scope === "STORE_WIDE");
    if (!storeWide) {
      const productIds = ctx.discounts.flatMap((d) => (d.scope === "PRODUCT" ? [...d.productIds] : []));
      const brandIds = ctx.discounts.flatMap((d) => (d.scope === "BRAND" ? [...d.brandIds] : []));
      const categoryIds = ctx.discounts.flatMap((d) => (d.scope === "CATEGORY" ? [...d.categoryIds].flatMap((id) => ctx.categories.descendants(id)) : []));
      and.push({
        OR: [
          { AND: [{ salePrice: { not: null } }, saleWindow] },
          { AND: [{ variants: { some: { isActive: true, salePrice: { not: null } } } }, saleWindow] },
          { compareAtPrice: { gt: prisma.product.fields.price } },
          ...(productIds.length ? [{ id: { in: productIds } }] : []),
          ...(brandIds.length ? [{ brandId: { in: brandIds } }] : []),
          ...(categoryIds.length ? [{ categoryId: { in: categoryIds } }] : []),
        ],
      });
    }
  }
  return { AND: and };
}

function catalogOrderBy(sort: CatalogSort | undefined): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
    case "price-asc":
      return [{ price: "asc" }];
    case "price-desc":
      return [{ price: "desc" }];
    case "popular":
      return [{ soldCount: "desc" }, { createdAt: "desc" }];
    case "name":
      return [{ name: "asc" }];
    default:
      return [{ isFeatured: "desc" }, { soldCount: "desc" }, { createdAt: "desc" }];
  }
}

export async function searchCatalog(db: Db, query: CatalogQuery, ctx?: LoadedPricingContext) {
  const context = ctx ?? (await loadPricingContext(db));
  const where = buildCatalogWhere(query, context);
  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [...catalogOrderBy(query.sort), { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: cardSelect,
    }),
    db.product.count({ where }),
  ]);
  return { products: rows.map((row) => toProductCard(row, context)), total, context };
}

export async function getProductCards(db: Db, where: Prisma.ProductWhereInput, take: number, orderBy?: Prisma.ProductOrderByWithRelationInput[], ctx?: LoadedPricingContext) {
  const context = ctx ?? (await loadPricingContext(db));
  const rows = await db.product.findMany({
    where: { AND: [{ status: "ACTIVE" }, { variants: { some: { isActive: true } } }, where] },
    orderBy: orderBy ?? [{ createdAt: "desc" }],
    take,
    select: cardSelect,
  });
  return rows.map((row) => toProductCard(row, context));
}

// ─────────────────────────────────────────────────────────────────────────────
// Product details
// ─────────────────────────────────────────────────────────────────────────────

export type ProductDetailVariant = {
  id: string;
  sku: string;
  name: string;
  options: Record<string, string>; // attributeId -> valueId
  price: UnitPrice;
  stock: number;
  stockState: "in" | "low" | "out";
};

export type ProductDetail = Awaited<ReturnType<typeof getProductDetail>>;

export async function getProductDetail(db: Db, slug: string) {
  const product = await db.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      brand: { select: { name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true, isActive: true } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          inventory: { select: { quantity: true, lowStockThreshold: true } },
          options: {
            include: {
              attribute: { select: { id: true, name: true, displayType: true, sortOrder: true } },
              attributeValue: { select: { id: true, value: true, colorHex: true, sortOrder: true } },
            },
          },
        },
      },
    },
  });
  if (!product || product.variants.length === 0 || !product.category.isActive) return null;

  const ctx = await loadPricingContext(db);
  const pricingProduct = toPricingProduct(product);
  const variants: ProductDetailVariant[] = product.variants.map((v) => {
    const stock = v.inventory?.quantity ?? 0;
    const threshold = v.inventory?.lowStockThreshold ?? product.lowStockThreshold;
    return {
      id: v.id,
      sku: v.sku,
      name: v.name,
      options: Object.fromEntries(v.options.map((o) => [o.attributeId, o.attributeValueId])),
      price: resolveUnitPrice(pricingProduct, toPricingVariant(v), ctx),
      stock,
      stockState: stockState(stock, threshold),
    };
  });

  const attributeMap = new Map<
    string,
    { id: string; name: string; displayType: "TEXT" | "COLOR"; sortOrder: number; values: Map<string, { id: string; value: string; colorHex: string | null; sortOrder: number }> }
  >();
  for (const v of product.variants) {
    for (const o of v.options) {
      const entry =
        attributeMap.get(o.attributeId) ??
        { id: o.attribute.id, name: o.attribute.name, displayType: o.attribute.displayType, sortOrder: o.attribute.sortOrder, values: new Map() };
      entry.values.set(o.attributeValue.id, o.attributeValue);
      attributeMap.set(o.attributeId, entry);
    }
  }
  const attributes = [...attributeMap.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((a) => ({ ...a, values: [...a.values.values()].sort((x, y) => x.sortOrder - y.sortOrder || x.value.localeCompare(y.value)) }));

  const specifications = Array.isArray(product.specifications) ? (product.specifications as { label: string; value: string }[]) : [];

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    sku: product.sku,
    shortDescription: product.shortDescription,
    description: product.description,
    productType: product.productType,
    brand: product.brand,
    category: product.category,
    categoryPath: ctx.categories.path(product.categoryId),
    images: product.images.map((i) => ({ url: i.url, alt: i.alt || product.name, width: i.width, height: i.height })),
    isNewArrival: product.isNewArrival,
    isBestSeller: product.isBestSeller,
    weightGrams: product.weightGrams,
    dimensions:
      product.lengthCm && product.widthCm && product.heightCm
        ? `${product.lengthCm.toString()} × ${product.widthCm.toString()} × ${product.heightCm.toString()} cm`
        : null,
    specifications,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    attributes,
    variants,
    hasOptions: attributes.length > 0,
    saleEndsAt: product.saleEndsAt,
    categoryId: product.categoryId,
    brandId: product.brandId,
  };
}

export async function getRelatedProducts(db: Db, product: { id: string; categoryId: string; brandId: string | null }, take = 4) {
  const ctx = await loadPricingContext(db);
  const siblings = ctx.categories.descendants(ctx.categories.lineage(product.categoryId).at(-1) ?? product.categoryId);
  return getProductCards(
    db,
    { id: { not: product.id }, categoryId: { in: siblings } },
    take,
    [{ soldCount: "desc" }, { createdAt: "desc" }],
    ctx,
  );
}
