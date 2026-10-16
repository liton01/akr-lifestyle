/**
 * Pricing engine — pure functions, no database access. All amounts are integer poisha.
 *
 * Stacking policy (applied consistently on product pages, cart, checkout and order creation):
 *
 * 1. Item level — the regular unit price is the variant's own price when set, otherwise the
 *    product's selling price. Candidate prices are:
 *      • the regular price,
 *      • the scheduled sale price (when inside the product's sale window), and
 *      • the regular price minus each applicable automatic promotion (store-wide, product,
 *        category incl. parent categories, or brand).
 *    The LOWEST candidate wins. Sale prices and promotions never stack with each other.
 * 2. Order level — at most ONE coupon per order. It applies to the eligible lines' item-level
 *    price (after step 1). Coupons configured with appliesToSaleItems = false skip lines that
 *    already received an item-level discount.
 * 3. Delivery fee is added last; free delivery is decided on the merchandise total after
 *    all discounts.
 * Totals can never go negative: discounts are clamped to the amount they apply to.
 */
import { allocateProportionally, percentageOf } from "@/lib/money";
import { isWithinWindow } from "@/lib/utils";

export type DiscountKind = "PERCENTAGE" | "FIXED_AMOUNT";

export type PricingProduct = {
  id: string;
  categoryId: string;
  brandId: string | null;
  price: number;
  compareAtPrice: number | null;
  salePrice: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
};

export type PricingVariant = {
  id: string;
  price: number | null;
  compareAtPrice: number | null;
  salePrice: number | null;
};

export type AutomaticDiscount = {
  id: string;
  name: string;
  type: DiscountKind;
  /** Basis points for PERCENTAGE (12.5% = 1250), poisha per unit for FIXED_AMOUNT. */
  value: number;
  scope: "STORE_WIDE" | "PRODUCT" | "CATEGORY" | "BRAND";
  maxDiscountAmount: number | null;
  badgeLabel: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  productIds: ReadonlySet<string>;
  categoryIds: ReadonlySet<string>;
  brandIds: ReadonlySet<string>;
};

export type PricingContext = {
  now: Date;
  discounts: readonly AutomaticDiscount[];
  /** Returns the category id followed by all of its ancestor ids. */
  categoryLineage: (categoryId: string) => readonly string[];
};

export type UnitPrice = {
  /** Regular selling price before item-level discounts (stored as originalUnitPrice). */
  regularPrice: number;
  finalPrice: number;
  discountPerUnit: number;
  discountLabel: string | null;
  discountSource: "NONE" | "SALE" | "PROMOTION";
  discountId: string | null;
  /** Price to show struck-through (MRP or regular price), or null when there is nothing to compare. */
  displayCompareAt: number | null;
  /** Whole-number percentage saved versus displayCompareAt, for badges. */
  savingsPercent: number;
};

export function isDiscountLive(discount: Pick<AutomaticDiscount, "isActive" | "startsAt" | "endsAt">, now: Date): boolean {
  return discount.isActive && isWithinWindow(now, discount.startsAt, discount.endsAt);
}

export function discountAppliesTo(
  discount: AutomaticDiscount,
  product: Pick<PricingProduct, "id" | "categoryId" | "brandId">,
  lineage: readonly string[],
): boolean {
  switch (discount.scope) {
    case "STORE_WIDE":
      return true;
    case "PRODUCT":
      return discount.productIds.has(product.id);
    case "CATEGORY":
      return lineage.some((id) => discount.categoryIds.has(id));
    case "BRAND":
      return product.brandId !== null && discount.brandIds.has(product.brandId);
  }
}

/** Discount amount for one unit (or one base amount), clamped to [0, base]. */
export function computeDiscountAmount(base: number, type: DiscountKind, value: number, maxDiscount: number | null): number {
  if (base <= 0 || value <= 0) return 0;
  let amount = type === "PERCENTAGE" ? percentageOf(base, Math.min(value, 10_000)) : value;
  if (maxDiscount !== null && maxDiscount >= 0) amount = Math.min(amount, maxDiscount);
  return Math.max(0, Math.min(amount, base));
}

export function defaultBadgeLabel(type: DiscountKind, value: number): string {
  if (type === "PERCENTAGE") {
    const pct = value / 100;
    return `-${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
  }
  return "Special offer";
}

export function resolveUnitPrice(product: PricingProduct, variant: PricingVariant | null, ctx: PricingContext): UnitPrice {
  const usesVariantPricing = variant !== null && variant.price !== null;
  const regularPrice = usesVariantPricing ? (variant.price as number) : product.price;
  const compareAt = usesVariantPricing ? variant.compareAtPrice : product.compareAtPrice;
  const salePrice = usesVariantPricing ? variant.salePrice : product.salePrice;

  let best: { price: number; label: string | null; source: UnitPrice["discountSource"]; id: string | null } = {
    price: regularPrice,
    label: null,
    source: "NONE",
    id: null,
  };

  if (
    salePrice !== null &&
    salePrice >= 0 &&
    salePrice < regularPrice &&
    isWithinWindow(ctx.now, product.saleStartsAt, product.saleEndsAt)
  ) {
    best = { price: salePrice, label: "Sale", source: "SALE", id: null };
  }

  const lineage = ctx.categoryLineage(product.categoryId);
  for (const discount of ctx.discounts) {
    if (!isDiscountLive(discount, ctx.now) || !discountAppliesTo(discount, product, lineage)) continue;
    const amount = computeDiscountAmount(regularPrice, discount.type, discount.value, discount.maxDiscountAmount);
    const price = regularPrice - amount;
    if (amount > 0 && price < best.price) {
      best = {
        price,
        label: discount.badgeLabel || defaultBadgeLabel(discount.type, discount.value),
        source: "PROMOTION",
        id: discount.id,
      };
    }
  }

  const reference = Math.max(compareAt ?? 0, regularPrice);
  const displayCompareAt = reference > best.price ? reference : null;
  const savingsPercent = displayCompareAt ? Math.floor(((displayCompareAt - best.price) * 100) / displayCompareAt) : 0;

  return {
    regularPrice,
    finalPrice: best.price,
    discountPerUnit: regularPrice - best.price,
    discountLabel: best.label,
    discountSource: best.source,
    discountId: best.id,
    displayCompareAt,
    savingsPercent,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Coupons
// ─────────────────────────────────────────────────────────────────────────────

export type CouponRule = {
  id: string;
  code: string;
  type: DiscountKind;
  value: number;
  scope: "ORDER" | "PRODUCT" | "CATEGORY";
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  usageLimit: number | null;
  usedCount: number;
  perCustomerLimit: number | null;
  newCustomersOnly: boolean;
  appliesToSaleItems: boolean;
  productIds: ReadonlySet<string>;
  categoryIds: ReadonlySet<string>;
};

export type CouponLine = {
  key: string;
  productId: string;
  categoryId: string;
  /** finalUnitPrice × quantity */
  lineSubtotal: number;
  hasItemDiscount: boolean;
};

export type CouponCustomerContext = {
  now: Date;
  /** Non-released uses of this coupon by the same customer (user id or phone). */
  customerUsageCount: number;
  /** True when the customer has no previous non-cancelled order. */
  isNewCustomer: boolean;
  categoryLineage: (categoryId: string) => readonly string[];
};

export type CouponEvaluation =
  | { ok: true; discount: number; allocations: Map<string, number>; eligibleSubtotal: number }
  | { ok: false; reason: string };

export function evaluateCoupon(coupon: CouponRule, lines: readonly CouponLine[], ctx: CouponCustomerContext): CouponEvaluation {
  if (!coupon.isActive) return { ok: false, reason: "This coupon is not active." };
  if (coupon.startsAt && ctx.now < coupon.startsAt) return { ok: false, reason: "This coupon is not valid yet." };
  if (coupon.endsAt && ctx.now >= coupon.endsAt) return { ok: false, reason: "This coupon has expired." };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: "This coupon has reached its usage limit." };
  }
  if (coupon.perCustomerLimit !== null && ctx.customerUsageCount >= coupon.perCustomerLimit) {
    return { ok: false, reason: "You have already used this coupon the maximum number of times." };
  }
  if (coupon.newCustomersOnly && !ctx.isNewCustomer) {
    return { ok: false, reason: "This coupon is only valid on your first order." };
  }

  const merchandiseTotal = lines.reduce((sum, line) => sum + line.lineSubtotal, 0);
  if (coupon.minOrderAmount !== null && merchandiseTotal < coupon.minOrderAmount) {
    return { ok: false, reason: `Add items worth at least ${formatMinorPlain(coupon.minOrderAmount)} to use this coupon.` };
  }

  const eligible = lines.filter((line) => {
    if (!coupon.appliesToSaleItems && line.hasItemDiscount) return false;
    if (coupon.scope === "ORDER") return true;
    if (coupon.scope === "PRODUCT") return coupon.productIds.has(line.productId);
    return ctx.categoryLineage(line.categoryId).some((id) => coupon.categoryIds.has(id));
  });
  const eligibleSubtotal = eligible.reduce((sum, line) => sum + line.lineSubtotal, 0);
  if (eligibleSubtotal <= 0) return { ok: false, reason: "This coupon does not apply to the items in your cart." };

  const discount = computeDiscountAmount(eligibleSubtotal, coupon.type, coupon.value, coupon.maxDiscountAmount);
  if (discount <= 0) return { ok: false, reason: "This coupon does not reduce your order total." };

  const parts = allocateProportionally(
    discount,
    eligible.map((line) => line.lineSubtotal),
  );
  const allocations = new Map<string, number>();
  eligible.forEach((line, index) => allocations.set(line.key, parts[index] ?? 0));
  return { ok: true, discount, allocations, eligibleSubtotal };
}

function formatMinorPlain(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  return `৳${whole.toLocaleString("en-IN")}${fraction ? `.${String(fraction).padStart(2, "0")}` : ""}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Delivery
// ─────────────────────────────────────────────────────────────────────────────

export type DeliveryZoneRule = {
  id: string;
  name: string;
  districts: readonly string[];
  fee: number;
  freeDeliveryThreshold: number | null;
  estimatedDays: string | null;
  isDefault: boolean;
  isActive: boolean;
};

export type DeliveryQuote = {
  zone: DeliveryZoneRule | null;
  fee: number;
  freeDeliveryApplied: boolean;
  /** Amount still needed to qualify for free delivery, when applicable. */
  amountToFreeDelivery: number | null;
};

export function findDeliveryZone(zones: readonly DeliveryZoneRule[], district: string): DeliveryZoneRule | null {
  const target = district.trim().toLowerCase();
  const active = zones.filter((zone) => zone.isActive);
  return (
    active.find((zone) => zone.districts.some((d) => d.toLowerCase() === target)) ??
    active.find((zone) => zone.isDefault) ??
    null
  );
}

export function quoteDelivery(
  zones: readonly DeliveryZoneRule[],
  district: string | null,
  merchandiseAfterDiscounts: number,
  freeDeliveryEnabled: boolean,
): DeliveryQuote {
  if (!district) return { zone: null, fee: 0, freeDeliveryApplied: false, amountToFreeDelivery: null };
  const zone = findDeliveryZone(zones, district);
  if (!zone) return { zone: null, fee: 0, freeDeliveryApplied: false, amountToFreeDelivery: null };
  const threshold = freeDeliveryEnabled ? zone.freeDeliveryThreshold : null;
  if (threshold !== null && merchandiseAfterDiscounts >= threshold) {
    return { zone, fee: 0, freeDeliveryApplied: true, amountToFreeDelivery: 0 };
  }
  return {
    zone,
    fee: zone.fee,
    freeDeliveryApplied: false,
    amountToFreeDelivery: threshold !== null ? threshold - merchandiseAfterDiscounts : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Totals
// ─────────────────────────────────────────────────────────────────────────────

export type TotalsInput = {
  lines: readonly { regularPrice: number; finalPrice: number; quantity: number }[];
  couponDiscount: number;
  deliveryFee: number;
};

export type Totals = {
  subtotal: number;
  itemDiscountTotal: number;
  merchandiseTotal: number;
  couponDiscount: number;
  deliveryFee: number;
  total: number;
};

export function computeTotals({ lines, couponDiscount, deliveryFee }: TotalsInput): Totals {
  const subtotal = lines.reduce((sum, line) => sum + line.regularPrice * line.quantity, 0);
  const merchandiseTotal = lines.reduce((sum, line) => sum + line.finalPrice * line.quantity, 0);
  const itemDiscountTotal = subtotal - merchandiseTotal;
  const safeCoupon = Math.max(0, Math.min(couponDiscount, merchandiseTotal));
  const safeDelivery = Math.max(0, deliveryFee);
  return {
    subtotal,
    itemDiscountTotal,
    merchandiseTotal,
    couponDiscount: safeCoupon,
    deliveryFee: safeDelivery,
    total: merchandiseTotal - safeCoupon + safeDelivery,
  };
}
