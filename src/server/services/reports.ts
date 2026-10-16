import { Prisma, type OrderStatus } from "@prisma/client";
import { toMinor } from "@/lib/money";
import type { Db } from "@/server/db";
import { addDays, formatZonedDateInput } from "@/server/services/dates";
import { inventorySummary } from "@/server/services/inventory";

/**
 * Metric definitions (all money in poisha, all periods in the store time zone):
 *
 * • Gross sales     — Σ total of orders PLACED in the period, excluding cancelled orders.
 * • Completed sales — Σ total of orders DELIVERED in the period (by deliveredAt), including
 *                     orders that were later returned.
 * • Refunds         — Σ completed refund amounts recorded in the period.
 * • Net sales       — Completed sales − Refunds.
 * • Cancelled       — orders cancelled in the period (by cancelledAt) and their value.
 * • Average order   — Gross sales ÷ number of non-cancelled orders placed in the period.
 * • Order status counts on the dashboard are CURRENT counts across all orders.
 */

const sumMinor = (value: Prisma.Decimal | null | undefined) => (value ? toMinor(value) : 0);

export type SalesSummary = {
  grossSales: number;
  ordersPlaced: number;
  averageOrderValue: number;
  completedSales: number;
  completedOrders: number;
  refunds: number;
  netSales: number;
  cancelledOrders: number;
  cancelledValue: number;
};

export async function salesSummary(db: Db, from: Date, to: Date): Promise<SalesSummary> {
  const [placed, completed, refunds, cancelled] = await Promise.all([
    db.order.aggregate({ _sum: { total: true }, _count: true, where: { createdAt: { gte: from, lt: to }, status: { not: "CANCELLED" } } }),
    db.order.aggregate({ _sum: { total: true }, _count: true, where: { deliveredAt: { gte: from, lt: to } } }),
    db.refund.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED", createdAt: { gte: from, lt: to } } }),
    db.order.aggregate({ _sum: { total: true }, _count: true, where: { cancelledAt: { gte: from, lt: to }, status: "CANCELLED" } }),
  ]);
  const grossSales = sumMinor(placed._sum.total);
  const completedSales = sumMinor(completed._sum.total);
  const refundTotal = sumMinor(refunds._sum.amount);
  return {
    grossSales,
    ordersPlaced: placed._count,
    averageOrderValue: placed._count ? Math.round(grossSales / placed._count) : 0,
    completedSales,
    completedOrders: completed._count,
    refunds: refundTotal,
    netSales: completedSales - refundTotal,
    cancelledOrders: cancelled._count,
    cancelledValue: sumMinor(cancelled._sum.total),
  };
}

export type TrendPoint = { day: string; orders: number; gross: number; cancelled: number };

export async function dailyTrend(db: Db, from: Date, to: Date, timeZone: string): Promise<TrendPoint[]> {
  const rows = await db.$queryRaw<{ day: string; orders: bigint; gross: Prisma.Decimal | null; cancelled: bigint }[]>`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS "day",
           COUNT(*) FILTER (WHERE "status" <> 'CANCELLED') AS "orders",
           SUM("total") FILTER (WHERE "status" <> 'CANCELLED') AS "gross",
           COUNT(*) FILTER (WHERE "status" = 'CANCELLED') AS "cancelled"
    FROM "Order"
    WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
    GROUP BY 1
    ORDER BY 1`;
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const points: TrendPoint[] = [];
  for (let cursor = from; cursor < to; cursor = addDays(cursor, 1)) {
    const day = formatZonedDateInput(cursor, timeZone);
    if (points.at(-1)?.day === day) continue;
    const row = byDay.get(day);
    points.push({ day, orders: Number(row?.orders ?? 0), gross: sumMinor(row?.gross), cancelled: Number(row?.cancelled ?? 0) });
  }
  return points;
}

export async function statusBreakdown(db: Db, from?: Date, to?: Date) {
  const groups = await db.order.groupBy({
    by: ["status"],
    _count: true,
    where: from && to ? { createdAt: { gte: from, lt: to } } : undefined,
  });
  const counts = Object.fromEntries(groups.map((g) => [g.status, g._count])) as Partial<Record<OrderStatus, number>>;
  return counts;
}

export async function topProducts(db: Db, from: Date, to: Date, take = 8) {
  const rows = await db.$queryRaw<{ productId: string | null; productName: string; quantity: bigint; revenue: Prisma.Decimal | null }[]>`
    SELECT oi."productId", MAX(oi."productName") AS "productName",
           SUM(oi."quantity" - oi."returnedQuantity") AS "quantity",
           SUM(oi."lineTotal") AS "revenue"
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    WHERE o."createdAt" >= ${from} AND o."createdAt" < ${to} AND o."status" <> 'CANCELLED'
    GROUP BY oi."productId"
    ORDER BY "quantity" DESC
    LIMIT ${take}`;
  return rows.map((r) => ({ productId: r.productId, productName: r.productName, quantity: Number(r.quantity), revenue: sumMinor(r.revenue) }));
}

export async function paymentMethodSplit(db: Db, from: Date, to: Date) {
  const groups = await db.order.groupBy({
    by: ["paymentMethod"],
    _count: true,
    _sum: { total: true },
    where: { createdAt: { gte: from, lt: to }, status: { not: "CANCELLED" } },
  });
  return groups.map((g) => ({ method: g.paymentMethod, orders: g._count, total: sumMinor(g._sum.total) }));
}

export async function catalogCounts(db: Db, now = new Date()) {
  const [totalProducts, activeProducts, totalCategories, totalCustomers, totalOrders, statusCounts, activeCoupons, liveDiscounts, inventory] =
    await Promise.all([
      db.product.count({ where: { status: { not: "ARCHIVED" } } }),
      db.product.count({ where: { status: "ACTIVE" } }),
      db.category.count(),
      db.user.count({ where: { role: "CUSTOMER" } }),
      db.order.count(),
      statusBreakdown(db),
      db.coupon.count({
        where: {
          isActive: true,
          AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
        },
      }),
      db.discount.count({
        where: {
          isActive: true,
          AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
        },
      }),
      inventorySummary(db),
    ]);
  return { totalProducts, activeProducts, totalCategories, totalCustomers, totalOrders, statusCounts, activeCoupons, liveDiscounts, inventory };
}

export async function lowStockList(db: Db, take = 8) {
  return db.$queryRaw<{ variantId: string; productId: string; productName: string; sku: string; variantName: string; quantity: number; threshold: number }[]>`
    SELECT v."id" AS "variantId", p."id" AS "productId", p."name" AS "productName", v."sku", v."name" AS "variantName",
           COALESCE(i."quantity", 0)::int AS "quantity", COALESCE(i."lowStockThreshold", p."lowStockThreshold")::int AS "threshold"
    FROM "ProductVariant" v
    JOIN "Product" p ON p."id" = v."productId"
    LEFT JOIN "Inventory" i ON i."variantId" = v."id"
    WHERE p."status" = 'ACTIVE' AND v."isActive" = true
      AND COALESCE(i."quantity", 0) <= COALESCE(i."lowStockThreshold", p."lowStockThreshold")
    ORDER BY COALESCE(i."quantity", 0) ASC, p."name" ASC
    LIMIT ${take}`;
}

/** Rows for the sales CSV export (one per order placed in the period). */
export async function ordersForExport(db: Db, from: Date, to: Date) {
  return db.order.findMany({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "asc" },
    select: {
      orderNumber: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      customerName: true,
      shippingDistrict: true,
      subtotal: true,
      itemDiscountTotal: true,
      couponDiscount: true,
      deliveryFee: true,
      total: true,
      refundedAmount: true,
    },
  });
}
