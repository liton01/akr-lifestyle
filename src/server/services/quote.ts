import type { Coupon, Prisma } from "@prisma/client";
import { toMinor, toMinorOrNull } from "@/lib/money";
import {
  computeTotals,
  evaluateCoupon,
  quoteDelivery,
  resolveUnitPrice,
  type CouponRule,
  type DeliveryQuote,
  type DeliveryZoneRule,
  type Totals,
  type UnitPrice,
} from "@/lib/pricing/engine";
import type { Db } from "@/server/db";
import { loadPricingContext, toPricingProduct, toPricingVariant, type LoadedPricingContext } from "@/server/services/pricing";

/**
 * Server-side quote: re-reads products, variants, stock, promotions, coupon and
 * delivery rules from the database. Client-supplied prices are never used.
 */

export type QuoteItemInput = { id: string; variantId: string; quantity: number };

export type PricedLine = {
  itemId: string;
  variantId: string;
  productId: string;
  categoryId: string;
  productName: string;
  productSlug: string;
  variantName: string | null;
  variantOptions: Record<string, string>;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  stock: number;
  purchasable: boolean;
  issue: string | null;
  price: UnitPrice;
  lineSubtotal: number;
  couponDiscount: number;
  lineTotal: number;
  costPrice: number | null;
};

const lineVariantInclude = {
  inventory: { select: { quantity: true } },
  options: {
    include: {
      attribute: { select: { name: true, sortOrder: true } },
      attributeValue: { select: { value: true } },
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      categoryId: true,
      brandId: true,
      price: true,
      compareAtPrice: true,
      salePrice: true,
      saleStartsAt: true,
      saleEndsAt: true,
      costPrice: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      category: { select: { isActive: true } },
    },
  },
} satisfies Prisma.ProductVariantInclude;

export async function priceLines(db: Db, items: QuoteItemInput[], ctx: LoadedPricingContext, maxPerLine: number): Promise<PricedLine[]> {
  if (items.length === 0) return [];
  const variants = await db.productVariant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    include: lineVariantInclude,
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines: PricedLine[] = [];
  for (const item of items) {
    const variant = byId.get(item.variantId);
    if (!variant) continue;
    const product = variant.product;
    const price = resolveUnitPrice(toPricingProduct(product), toPricingVariant(variant), ctx);
    const stock = variant.inventory?.quantity ?? 0;
    const active = product.status === "ACTIVE" && variant.isActive && product.category.isActive;
    let issue: string | null = null;
    if (!active) issue = "This item is no longer available.";
    else if (stock <= 0) issue = "Out of stock.";
    else if (item.quantity > stock) issue = `Only ${stock} available — please reduce the quantity.`;
    else if (item.quantity > maxPerLine) issue = `You can order at most ${maxPerLine} of this item.`;
    const options = [...variant.options].sort((a, b) => a.attribute.sortOrder - b.attribute.sortOrder);
    const lineSubtotal = price.finalPrice * item.quantity;
    lines.push({
      itemId: item.id,
      variantId: variant.id,
      productId: product.id,
      categoryId: product.categoryId,
      productName: product.name,
      productSlug: product.slug,
      variantName: variant.isDefault || options.length === 0 ? null : variant.name,
      variantOptions: Object.fromEntries(options.map((o) => [o.attribute.name, o.attributeValue.value])),
      sku: variant.sku,
      imageUrl: variant.imageUrl ?? product.images[0]?.url ?? null,
      quantity: item.quantity,
      stock,
      purchasable: issue === null,
      issue,
      price,
      lineSubtotal,
      couponDiscount: 0,
      lineTotal: lineSubtotal,
      costPrice: toMinorOrNull(variant.costPrice ?? product.costPrice),
    });
  }
  return lines;
}

export function toCouponRule(coupon: Coupon & { products: { id: string }[]; categories: { id: string }[] }): CouponRule {
  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: toMinor(coupon.value),
    scope: coupon.scope,
    minOrderAmount: toMinorOrNull(coupon.minOrderAmount),
    maxDiscountAmount: toMinorOrNull(coupon.maxDiscountAmount),
    startsAt: coupon.startsAt,
    endsAt: coupon.endsAt,
    isActive: coupon.isActive,
    usageLimit: coupon.usageLimit,
    usedCount: coupon.usedCount,
    perCustomerLimit: coupon.perCustomerLimit,
    newCustomersOnly: coupon.newCustomersOnly,
    appliesToSaleItems: coupon.appliesToSaleItems,
    productIds: new Set(coupon.products.map((p) => p.id)),
    categoryIds: new Set(coupon.categories.map((c) => c.id)),
  };
}

export type CustomerIdentity = { userId: string | null; phone: string | null };

export async function customerCouponUsage(db: Db, couponId: string, customer: CustomerIdentity): Promise<number> {
  const or: Prisma.CouponUsageWhereInput[] = [];
  if (customer.userId) or.push({ userId: customer.userId });
  if (customer.phone) or.push({ customerKey: customer.phone });
  if (or.length === 0) return 0;
  return db.couponUsage.count({ where: { couponId, releasedAt: null, OR: or } });
}

export async function isNewCustomer(db: Db, customer: CustomerIdentity): Promise<boolean> {
  const or: Prisma.OrderWhereInput[] = [];
  if (customer.userId) or.push({ userId: customer.userId });
  if (customer.phone) or.push({ customerPhone: customer.phone });
  if (or.length === 0) return true;
  const count = await db.order.count({ where: { status: { not: "CANCELLED" }, OR: or } });
  return count === 0;
}

export async function loadDeliveryZones(db: Db): Promise<DeliveryZoneRule[]> {
  const zones = await db.deliveryZone.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    districts: z.districts,
    fee: toMinor(z.fee),
    freeDeliveryThreshold: toMinorOrNull(z.freeDeliveryThreshold),
    estimatedDays: z.estimatedDays,
    isDefault: z.isDefault,
    isActive: z.isActive,
  }));
}

export type Quote = {
  lines: PricedLine[];
  coupon: { id: string; code: string; discount: number } | null;
  couponError: string | null;
  delivery: DeliveryQuote;
  totals: Totals;
  purchasable: boolean;
};

export async function buildQuote(
  db: Db,
  input: {
    items: QuoteItemInput[];
    couponCode: string | null;
    district: string | null;
    customer: CustomerIdentity;
    freeDeliveryEnabled: boolean;
    maxPerLine: number;
    now?: Date;
    /** Lock the coupon row (inside the order transaction) so usage limits hold under concurrency. */
    lockCoupon?: boolean;
  },
): Promise<Quote> {
  const now = input.now ?? new Date();
  const ctx = await loadPricingContext(db, now);
  const lines = await priceLines(db, input.items, ctx, input.maxPerLine);

  let coupon: Quote["coupon"] = null;
  let couponError: string | null = null;
  const code = input.couponCode?.trim().toUpperCase();
  if (code) {
    if (input.lockCoupon) {
      await db.$queryRaw`SELECT "id" FROM "Coupon" WHERE "code" = ${code} FOR UPDATE`;
    }
    const row = await db.coupon.findUnique({
      where: { code },
      include: { products: { select: { id: true } }, categories: { select: { id: true } } },
    });
    if (!row) {
      couponError = "This coupon code is not valid.";
    } else {
      const [usage, isNew] = await Promise.all([customerCouponUsage(db, row.id, input.customer), isNewCustomer(db, input.customer)]);
      const purchasableLines = lines.filter((l) => l.purchasable);
      const evaluation = evaluateCoupon(
        toCouponRule(row),
        purchasableLines.map((l) => ({
          key: l.itemId,
          productId: l.productId,
          categoryId: l.categoryId,
          lineSubtotal: l.lineSubtotal,
          hasItemDiscount: l.price.discountPerUnit > 0,
        })),
        { now, customerUsageCount: usage, isNewCustomer: isNew, categoryLineage: ctx.categoryLineage },
      );
      if (evaluation.ok) {
        coupon = { id: row.id, code: row.code, discount: evaluation.discount };
        for (const line of lines) {
          line.couponDiscount = evaluation.allocations.get(line.itemId) ?? 0;
          line.lineTotal = line.lineSubtotal - line.couponDiscount;
        }
      } else {
        couponError = evaluation.reason;
      }
    }
  }

  const purchasableLines = lines.filter((l) => l.purchasable);
  const merchandise = purchasableLines.reduce((sum, l) => sum + l.lineSubtotal, 0);
  const zones = await loadDeliveryZones(db);
  const delivery = quoteDelivery(zones, input.district, merchandise - (coupon?.discount ?? 0), input.freeDeliveryEnabled);
  const totals = computeTotals({
    lines: purchasableLines.map((l) => ({ regularPrice: l.price.regularPrice, finalPrice: l.price.finalPrice, quantity: l.quantity })),
    couponDiscount: coupon?.discount ?? 0,
    deliveryFee: delivery.fee,
  });
  return {
    lines,
    coupon,
    couponError,
    delivery,
    totals,
    purchasable: lines.length > 0 && lines.every((l) => l.purchasable),
  };
}
