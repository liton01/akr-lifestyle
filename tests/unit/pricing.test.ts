import { describe, expect, it } from "vitest";
import {
  computeTotals,
  evaluateCoupon,
  quoteDelivery,
  resolveUnitPrice,
  type AutomaticDiscount,
  type CouponRule,
  type PricingContext,
  type PricingProduct,
} from "@/lib/pricing/engine";

const NOW = new Date("2026-10-16T06:00:00Z");
const DAY = 86_400_000;

const product = (overrides: Partial<PricingProduct> = {}): PricingProduct => ({
  id: "p1",
  categoryId: "rings",
  brandId: "aurelle",
  price: 1_000_00,
  compareAtPrice: null,
  salePrice: null,
  saleStartsAt: null,
  saleEndsAt: null,
  ...overrides,
});

const discount = (overrides: Partial<AutomaticDiscount> = {}): AutomaticDiscount => ({
  id: "d1",
  name: "Promo",
  type: "PERCENTAGE",
  value: 10_00,
  scope: "STORE_WIDE",
  maxDiscountAmount: null,
  badgeLabel: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
  productIds: new Set(),
  categoryIds: new Set(),
  brandIds: new Set(),
  ...overrides,
});

const lineage = (id: string) => (id === "rings" ? ["rings", "jewellery"] : [id]);
const ctx = (discounts: AutomaticDiscount[] = []): PricingContext => ({ now: NOW, discounts, categoryLineage: lineage });

describe("unit price resolution", () => {
  it("uses the regular price when nothing applies", () => {
    const price = resolveUnitPrice(product(), null, ctx());
    expect(price).toMatchObject({ regularPrice: 100000, finalPrice: 100000, discountPerUnit: 0, discountSource: "NONE", displayCompareAt: null });
  });

  it("applies a scheduled sale only inside its window", () => {
    const inside = product({ salePrice: 80000, saleStartsAt: new Date(NOW.getTime() - DAY), saleEndsAt: new Date(NOW.getTime() + DAY) });
    expect(resolveUnitPrice(inside, null, ctx()).finalPrice).toBe(80000);
    const future = product({ salePrice: 80000, saleStartsAt: new Date(NOW.getTime() + DAY) });
    expect(resolveUnitPrice(future, null, ctx()).finalPrice).toBe(100000);
    const ended = product({ salePrice: 80000, saleEndsAt: new Date(NOW.getTime() - 1) });
    expect(resolveUnitPrice(ended, null, ctx()).finalPrice).toBe(100000);
  });

  it("never stacks: the single best of sale and promotions wins", () => {
    const p = product({ salePrice: 85000 });
    const tenPercent = discount({ value: 10_00 });
    const twentyPercent = discount({ id: "d2", value: 20_00, scope: "CATEGORY", categoryIds: new Set(["jewellery"]) });
    expect(resolveUnitPrice(p, null, ctx([tenPercent])).finalPrice).toBe(85000); // sale (15%) beats 10%
    const best = resolveUnitPrice(p, null, ctx([tenPercent, twentyPercent]));
    expect(best.finalPrice).toBe(80000); // 20% category promo (parent category match) beats sale
    expect(best.discountSource).toBe("PROMOTION");
    expect(best.discountId).toBe("d2");
  });

  it("ignores inactive, expired and non-matching promotions", () => {
    const p = product();
    expect(resolveUnitPrice(p, null, ctx([discount({ isActive: false })])).finalPrice).toBe(100000);
    expect(resolveUnitPrice(p, null, ctx([discount({ endsAt: new Date(NOW.getTime() - 1) })])).finalPrice).toBe(100000);
    expect(resolveUnitPrice(p, null, ctx([discount({ scope: "BRAND", brandIds: new Set(["other"]) })])).finalPrice).toBe(100000);
    expect(resolveUnitPrice(p, null, ctx([discount({ scope: "PRODUCT", productIds: new Set(["p1"]) })])).finalPrice).toBe(90000);
  });

  it("caps percentage promotions and never produces a negative price", () => {
    const capped = resolveUnitPrice(product(), null, ctx([discount({ value: 50_00, maxDiscountAmount: 10000 })]));
    expect(capped.finalPrice).toBe(90000);
    const huge = resolveUnitPrice(product(), null, ctx([discount({ type: "FIXED_AMOUNT", value: 5_000_00 })]));
    expect(huge.finalPrice).toBe(0);
  });

  it("uses variant pricing when the variant overrides the price", () => {
    const p = product({ salePrice: 50000 });
    const variant = { id: "v1", price: 120000, compareAtPrice: null, salePrice: null };
    const price = resolveUnitPrice(p, variant, ctx());
    expect(price.regularPrice).toBe(120000);
    expect(price.finalPrice).toBe(120000); // product sale does not leak into an overriding variant
  });

  it("shows the higher of MRP and regular price as the compare-at price", () => {
    const price = resolveUnitPrice(product({ compareAtPrice: 125000 }), null, ctx([discount()]));
    expect(price.displayCompareAt).toBe(125000);
    expect(price.savingsPercent).toBe(28);
  });
});

const coupon = (overrides: Partial<CouponRule> = {}): CouponRule => ({
  id: "c1",
  code: "SAVE",
  type: "PERCENTAGE",
  value: 10_00,
  scope: "ORDER",
  minOrderAmount: null,
  maxDiscountAmount: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
  usageLimit: null,
  usedCount: 0,
  perCustomerLimit: null,
  newCustomersOnly: false,
  appliesToSaleItems: true,
  productIds: new Set(),
  categoryIds: new Set(),
  ...overrides,
});

const couponCtx = { now: NOW, customerUsageCount: 0, isNewCustomer: true, categoryLineage: lineage };
const lines = [
  { key: "a", productId: "p1", categoryId: "rings", lineSubtotal: 300000, hasItemDiscount: false },
  { key: "b", productId: "p2", categoryId: "audio", lineSubtotal: 100000, hasItemDiscount: true },
];

describe("coupons", () => {
  it("applies a percentage coupon and allocates it across lines", () => {
    const result = evaluateCoupon(coupon(), lines, couponCtx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.discount).toBe(40000);
    expect(result.allocations.get("a")).toBe(30000);
    expect(result.allocations.get("b")).toBe(10000);
  });

  it("rejects expired, not-yet-valid and inactive coupons", () => {
    expect(evaluateCoupon(coupon({ endsAt: new Date(NOW.getTime() - 1) }), lines, couponCtx)).toEqual({ ok: false, reason: "This coupon has expired." });
    expect(evaluateCoupon(coupon({ startsAt: new Date(NOW.getTime() + DAY) }), lines, couponCtx).ok).toBe(false);
    expect(evaluateCoupon(coupon({ isActive: false }), lines, couponCtx).ok).toBe(false);
  });

  it("enforces total and per-customer usage limits", () => {
    expect(evaluateCoupon(coupon({ usageLimit: 5, usedCount: 5 }), lines, couponCtx).ok).toBe(false);
    expect(evaluateCoupon(coupon({ usageLimit: 5, usedCount: 4 }), lines, couponCtx).ok).toBe(true);
    expect(evaluateCoupon(coupon({ perCustomerLimit: 1 }), lines, { ...couponCtx, customerUsageCount: 1 }).ok).toBe(false);
  });

  it("enforces first-order-only and minimum order amount", () => {
    expect(evaluateCoupon(coupon({ newCustomersOnly: true }), lines, { ...couponCtx, isNewCustomer: false }).ok).toBe(false);
    const min = evaluateCoupon(coupon({ minOrderAmount: 500000 }), lines, couponCtx);
    expect(min.ok).toBe(false);
  });

  it("respects scope and the sale-item exclusion", () => {
    const category = evaluateCoupon(coupon({ scope: "CATEGORY", categoryIds: new Set(["jewellery"]) }), lines, couponCtx);
    expect(category.ok && category.discount).toBe(30000);
    const noSale = evaluateCoupon(coupon({ appliesToSaleItems: false }), lines, couponCtx);
    expect(noSale.ok && noSale.discount).toBe(30000);
    expect(noSale.ok && noSale.allocations.has("b")).toBe(false);
    const none = evaluateCoupon(coupon({ scope: "PRODUCT", productIds: new Set(["zzz"]) }), lines, couponCtx);
    expect(none.ok).toBe(false);
  });

  it("never discounts more than the eligible subtotal", () => {
    const result = evaluateCoupon(coupon({ type: "FIXED_AMOUNT", value: 10_000_00 }), lines, couponCtx);
    expect(result.ok && result.discount).toBe(400000);
    const capped = evaluateCoupon(coupon({ value: 50_00, maxDiscountAmount: 50000 }), lines, couponCtx);
    expect(capped.ok && capped.discount).toBe(50000);
  });
});

describe("delivery and totals", () => {
  const zones = [
    { id: "z1", name: "Inside Dhaka", districts: ["Dhaka"], fee: 7000, freeDeliveryThreshold: 500000, estimatedDays: null, isDefault: false, isActive: true },
    { id: "z2", name: "Outside Dhaka", districts: [], fee: 13000, freeDeliveryThreshold: null, estimatedDays: null, isDefault: true, isActive: true },
  ];

  it("matches the district zone, falls back to the default zone and applies free delivery", () => {
    expect(quoteDelivery(zones, "dhaka", 100000, true)).toMatchObject({ fee: 7000, amountToFreeDelivery: 400000 });
    expect(quoteDelivery(zones, "Dhaka", 500000, true)).toMatchObject({ fee: 0, freeDeliveryApplied: true });
    expect(quoteDelivery(zones, "Dhaka", 500000, false)).toMatchObject({ fee: 7000 });
    expect(quoteDelivery(zones, "Sylhet", 900000, true).zone?.name).toBe("Outside Dhaka");
  });

  it("computes totals that never go negative", () => {
    const totals = computeTotals({ lines: [{ regularPrice: 100000, finalPrice: 90000, quantity: 2 }], couponDiscount: 999999999, deliveryFee: 7000 });
    expect(totals).toEqual({ subtotal: 200000, itemDiscountTotal: 20000, merchandiseTotal: 180000, couponDiscount: 180000, deliveryFee: 7000, total: 7000 });
  });
});
