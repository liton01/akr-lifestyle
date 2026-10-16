import { Prisma, type Order, type OrderStatus, type PaymentStatus, type PrismaClient } from "@prisma/client";
import {
  ConflictError,
  InvalidTransitionError,
  NotFoundError,
  PriceChangedError,
  UnauthorizedError,
  ValidationError,
  isUniqueViolation,
} from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import { canStaffTransition, canCustomerCancel } from "@/lib/order-status";
import type { Actor } from "@/lib/permissions";
import type { StoreSettings } from "@/lib/settings-schema";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation/checkout";
import { writeAudit } from "@/server/audit";
import { randomCode } from "@/server/crypto";
import { withTransaction, type Db, type Tx } from "@/server/db";
import { assertPermission } from "@/server/services/authz";
import { findCart, type CartOwner } from "@/server/services/cart";
import { zonedParts } from "@/server/services/dates";
import { deductStockForOrder, restoreStock, type LowStockHit } from "@/server/services/inventory";
import { buildQuote } from "@/server/services/quote";

// ─────────────────────────────────────────────────────────────────────────────
// Order placement
// ─────────────────────────────────────────────────────────────────────────────

export function generateOrderNumber(now: Date, timeZone: string): string {
  const p = zonedParts(now, timeZone);
  const date = `${String(p.year).slice(-2)}${String(p.month).padStart(2, "0")}${String(p.day).padStart(2, "0")}`;
  return `AKR${date}-${randomCode(5)}`;
}

export type PlaceOrderContext = {
  userId: string | null;
  owner: CartOwner;
  settings: Pick<StoreSettings, "commerce" | "general">;
  /** Whether an online gateway is configured (credentials present). */
  onlinePaymentAvailable: boolean;
  now?: Date;
};

export type PlaceOrderResult = {
  order: Pick<Order, "id" | "orderNumber" | "paymentMethod" | "status" | "paymentStatus"> & { total: number };
  duplicate: boolean;
  lowStock: LowStockHit[];
};

function summarise(order: Order): PlaceOrderResult["order"] {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: toMinor(order.total),
  };
}

async function existingForKey(db: Db, input: CheckoutInput, userId: string | null) {
  const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (!existing) return null;
  // The same key from a different account is never treated as a retry.
  if (existing.userId !== userId || existing.customerPhone !== input.phone) {
    throw new ConflictError("This checkout session was already used. Please refresh the page.");
  }
  return existing;
}

async function createOrderInTransaction(tx: Tx, data: CheckoutInput, context: PlaceOrderContext): Promise<PlaceOrderResult> {
  const { commerce, general } = context.settings;
  const now = context.now ?? new Date();

  // Serialise concurrent submissions of the same checkout, then re-check inside the lock.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${data.idempotencyKey}, 0))`;
  const duplicate = await existingForKey(tx, data, context.userId);
  if (duplicate) return { order: summarise(duplicate), duplicate: true, lowStock: [] };

  // Lock the cart so two tabs sharing it cannot both turn it into an order.
  const unlocked = await findCart(tx, context.owner);
  if (unlocked) await tx.$queryRaw`SELECT "id" FROM "Cart" WHERE "id" = ${unlocked.id} FOR UPDATE`;
  const cart = unlocked ? await findCart(tx, context.owner) : null;
  if (!cart || cart.items.length === 0) throw new ValidationError("Your cart is empty.");

  const couponCode = data.couponCode ?? cart.couponCode;
  const quote = await buildQuote(tx, {
    items: cart.items.map((i) => ({ id: i.id, variantId: i.variantId, quantity: i.quantity })),
    couponCode,
    district: data.district,
    customer: { userId: context.userId, phone: data.phone },
    freeDeliveryEnabled: commerce.freeDeliveryEnabled,
    maxPerLine: commerce.maxQuantityPerLine,
    now,
    lockCoupon: true,
  });

  const problem = quote.lines.find((l) => !l.purchasable);
  if (problem) throw new ValidationError(`${problem.productName}: ${problem.issue}`);
  if (quote.lines.length === 0) throw new ValidationError("Your cart is empty.");
  if (couponCode && quote.couponError) throw new ValidationError(quote.couponError, { couponCode: [quote.couponError] });
  if (!quote.delivery.zone) throw new ValidationError("Delivery is not available for this district yet.", { district: ["Not deliverable."] });
  if (data.expectedTotal !== null && data.expectedTotal !== quote.totals.total) throw new PriceChangedError(quote.totals.total);

  const shippingAddress = {
    fullName: data.fullName,
    phone: data.phone,
    district: data.district,
    area: data.area,
    addressLine: data.addressLine,
    postalCode: data.postalCode,
  };
  const billingAddress = data.billingSameAsShipping
    ? Prisma.DbNull
    : { fullName: data.billingFullName, phone: data.billingPhone, district: data.billingDistrict, addressLine: data.billingAddressLine };

  const order = await tx.order.create({
    data: {
      orderNumber: generateOrderNumber(now, general.timeZone),
      idempotencyKey: data.idempotencyKey,
      userId: context.userId,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: data.paymentMethod,
      customerName: data.fullName,
      customerPhone: data.phone,
      customerEmail: data.email,
      shippingAddress,
      billingAddress,
      shippingDistrict: data.district,
      deliveryZoneName: quote.delivery.zone.name,
      deliveryInstructions: data.deliveryInstructions,
      subtotal: fromMinor(quote.totals.subtotal),
      itemDiscountTotal: fromMinor(quote.totals.itemDiscountTotal),
      couponId: quote.coupon?.id ?? null,
      couponCode: quote.coupon?.code ?? null,
      couponDiscount: fromMinor(quote.totals.couponDiscount),
      deliveryFee: fromMinor(quote.totals.deliveryFee),
      total: fromMinor(quote.totals.total),
      paymentDueBy: data.paymentMethod === "SSLCOMMERZ" ? new Date(now.getTime() + commerce.paymentTimeoutMinutes * 60_000) : null,
      items: {
        create: quote.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          productName: line.productName,
          productSlug: line.productSlug,
          sku: line.sku,
          variantName: line.variantName,
          variantOptions: Object.keys(line.variantOptions).length ? line.variantOptions : Prisma.DbNull,
          imageUrl: line.imageUrl,
          originalUnitPrice: fromMinor(line.price.regularPrice),
          discountPerUnit: fromMinor(line.price.discountPerUnit),
          finalUnitPrice: fromMinor(line.price.finalPrice),
          discountLabel: line.price.discountLabel,
          quantity: line.quantity,
          lineSubtotal: fromMinor(line.lineSubtotal),
          couponDiscount: fromMinor(line.couponDiscount),
          lineTotal: fromMinor(line.lineTotal),
          costPriceSnapshot: line.costPrice === null ? null : fromMinor(line.costPrice),
        })),
      },
      statusHistory: {
        create: { toStatus: "PENDING", actorType: "CUSTOMER", actorId: context.userId, note: "Order placed" },
      },
    },
  });

  const lowStock = await deductStockForOrder(
    tx,
    order.id,
    quote.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, sku: l.sku, productName: l.productName })),
    context.userId,
  );

  const soldByProduct = new Map<string, number>();
  for (const line of quote.lines) soldByProduct.set(line.productId, (soldByProduct.get(line.productId) ?? 0) + line.quantity);
  for (const [productId, quantity] of soldByProduct) {
    await tx.product.update({ where: { id: productId }, data: { soldCount: { increment: quantity } } });
  }

  if (quote.coupon) {
    const updated = await tx.$executeRaw`
      UPDATE "Coupon" SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
      WHERE "id" = ${quote.coupon.id} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
    if (updated === 0) throw new ValidationError("This coupon has reached its usage limit.", { couponCode: ["Usage limit reached."] });
    await tx.couponUsage.create({
      data: {
        couponId: quote.coupon.id,
        orderId: order.id,
        userId: context.userId,
        customerKey: data.phone,
        discountAmount: fromMinor(quote.coupon.discount),
      },
    });
  }

  if (context.userId && data.saveAddress) {
    const duplicate = await tx.address.findFirst({
      where: { userId: context.userId, phone: data.phone, district: data.district, addressLine: data.addressLine },
      select: { id: true },
    });
    if (!duplicate) {
      const count = await tx.address.count({ where: { userId: context.userId } });
      await tx.address.create({
        data: {
          userId: context.userId,
          fullName: data.fullName,
          phone: data.phone,
          district: data.district,
          area: data.area,
          addressLine: data.addressLine,
          postalCode: data.postalCode,
          isDefault: count === 0,
        },
      });
    }
  }

  await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
  await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });

  return { order: summarise(order), duplicate: false, lowStock };
}

/**
 * Create an order from the caller's cart. Everything — repricing, coupon checks, stock
 * deduction, coupon usage, order rows and cart clearing — happens in one transaction.
 * Retrying with the same idempotency key returns the original order instead of a new one.
 */
export async function placeOrder(db: PrismaClient, rawInput: unknown, ctx: PlaceOrderContext): Promise<PlaceOrderResult> {
  const input = checkoutSchema.parse(rawInput);
  const { commerce } = ctx.settings;

  if (input.paymentMethod === "COD" && !commerce.codEnabled) {
    throw new ValidationError("Cash on delivery is currently unavailable.", { paymentMethod: ["Choose another payment method."] });
  }
  if (input.paymentMethod === "SSLCOMMERZ" && !(commerce.onlinePaymentEnabled && ctx.onlinePaymentAvailable)) {
    throw new ValidationError("Online payment is currently unavailable.", { paymentMethod: ["Choose another payment method."] });
  }
  if (!ctx.userId && !commerce.guestCheckoutEnabled) throw new UnauthorizedError("Please sign in to place an order.");

  const prior = await existingForKey(db, input, ctx.userId);
  if (prior) return { order: summarise(prior), duplicate: true, lowStock: [] };

  for (let attempt = 1; ; attempt++) {
    try {
      return await withTransaction(db, (tx) => createOrderInTransaction(tx, input, ctx), { maxAttempts: 4 });
    } catch (error) {
      if (isUniqueViolation(error, "idempotencyKey")) {
        const existing = await existingForKey(db, input, ctx.userId);
        if (existing) return { order: summarise(existing), duplicate: true, lowStock: [] };
      }
      if (isUniqueViolation(error, "orderNumber") && attempt < 3) continue;
      throw error;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation & status changes
// ─────────────────────────────────────────────────────────────────────────────

export type OrderActor = { type: "CUSTOMER"; userId: string } | { type: "STAFF"; actor: Actor } | { type: "SYSTEM" };

async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, couponUsage: true } });
  if (!order) throw new NotFoundError("Order not found.");
  return order;
}

/** Restores stock once per order (guarded by stockRestoredAt). Returns true if it ran. */
async function restoreOrderStockOnce(tx: Tx, order: Awaited<ReturnType<typeof lockOrder>>, actorId: string | null, reason: string) {
  const claimed = await tx.order.updateMany({ where: { id: order.id, stockRestoredAt: null }, data: { stockRestoredAt: new Date() } });
  if (claimed.count === 0) return false;
  const lines = order.items
    .filter((item) => item.variantId)
    .map((item) => ({ variantId: item.variantId!, quantity: item.quantity - item.returnedQuantity, sku: item.sku, productName: item.productName }))
    .filter((l) => l.quantity > 0);
  await restoreStock(tx, lines, { type: "ORDER_CANCELLED", orderId: order.id, actorId, reason });
  for (const item of order.items) {
    const qty = item.quantity - item.returnedQuantity;
    if (item.productId && qty > 0) {
      await tx.$executeRaw`UPDATE "Product" SET "soldCount" = GREATEST("soldCount" - ${qty}, 0) WHERE "id" = ${item.productId}`;
    }
  }
  return true;
}

async function releaseCouponOnce(tx: Tx, order: Awaited<ReturnType<typeof lockOrder>>) {
  if (!order.couponUsage || order.couponUsage.releasedAt) return;
  const released = await tx.couponUsage.updateMany({ where: { id: order.couponUsage.id, releasedAt: null }, data: { releasedAt: new Date() } });
  if (released.count === 1) {
    await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "id" = ${order.couponUsage.couponId}`;
  }
}

function actorFields(by: OrderActor) {
  return by.type === "STAFF"
    ? { actorType: "STAFF", actorId: by.actor.id }
    : by.type === "CUSTOMER"
      ? { actorType: "CUSTOMER", actorId: by.userId }
      : { actorType: "SYSTEM", actorId: null };
}

/**
 * Cancel an order. Idempotent: cancelling an already-cancelled order is a no-op, and
 * stock / coupon usage are released at most once even if this is retried concurrently.
 */
export async function cancelOrder(db: PrismaClient, orderId: string, by: OrderActor, reason: string) {
  if (by.type === "STAFF") assertPermission(by.actor, "order:update");
  return withTransaction(db, async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (by.type === "CUSTOMER" && order.userId !== by.userId) throw new NotFoundError("Order not found.");
    if (order.status === "CANCELLED") return { order, changed: false };

    const allowed =
      by.type === "CUSTOMER" ? canCustomerCancel(order.status) : by.type === "SYSTEM" ? order.status === "PENDING" : canStaffTransition(order.status, "CANCELLED");
    if (!allowed) {
      if (by.type === "CUSTOMER") throw new ConflictError("This order is already being processed. Please contact customer care to cancel it.");
      throw new InvalidTransitionError(order.status, "CANCELLED");
    }

    const fields = actorFields(by);
    const now = new Date();
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason.slice(0, 500) },
    });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: "CANCELLED", note: reason.slice(0, 500), ...fields },
    });
    await restoreOrderStockOnce(tx, order, fields.actorId, `Order cancelled: ${reason}`.slice(0, 300));
    await releaseCouponOnce(tx, order);
    await tx.payment.updateMany({ where: { orderId: order.id, status: "INITIATED" }, data: { status: "CANCELLED" } });
    if (by.type === "STAFF") {
      await writeAudit(tx, by.actor, { action: "order.cancel", entityType: "Order", entityId: order.id, metadata: { reason } });
    }
    return { order: updated, changed: true };
  });
}

export async function updateOrderStatus(
  db: PrismaClient,
  actor: Actor,
  orderId: string,
  input: { status: OrderStatus; note?: string | null; courierName?: string | null; trackingNumber?: string | null },
) {
  assertPermission(actor, "order:update");
  if (input.status === "CANCELLED") return cancelOrder(db, orderId, { type: "STAFF", actor }, input.note || "Cancelled by staff");

  return withTransaction(db, async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status === input.status) return { order, changed: false };
    if (!canStaffTransition(order.status, input.status)) throw new InvalidTransitionError(order.status, input.status);
    if (input.status === "SHIPPED" && order.paymentMethod === "SSLCOMMERZ" && order.paymentStatus !== "PAID") {
      throw new ConflictError("Online-payment orders can only be shipped after payment is confirmed.");
    }

    const now = new Date();
    const data: Prisma.OrderUpdateInput = { status: input.status };
    if (input.status === "CONFIRMED") data.confirmedAt = now;
    if (input.status === "SHIPPED") {
      data.shippedAt = now;
      if (input.courierName !== undefined) data.courierName = input.courierName;
      if (input.trackingNumber !== undefined) data.trackingNumber = input.trackingNumber;
    }
    if (input.status === "DELIVERED") data.deliveredAt = now;

    const updated = await tx.order.update({ where: { id: order.id }, data });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: input.status, note: input.note ?? null, actorType: "STAFF", actorId: actor.id },
    });
    // Parcel returned to sender before delivery: goods come back into stock.
    if (input.status === "RETURNED") {
      await restoreOrderStockOnce(tx, order, actor.id, "Returned to sender (undelivered)");
    }
    await writeAudit(tx, actor, {
      action: "order.status",
      entityType: "Order",
      entityId: order.id,
      metadata: { from: order.status, to: input.status, note: input.note ?? null },
    });
    return { order: updated, changed: true };
  });
}

export async function updateOrderShipping(db: Db, actor: Actor, orderId: string, input: { courierName: string | null; trackingNumber: string | null }) {
  assertPermission(actor, "order:update");
  const order = await db.order.update({ where: { id: orderId }, data: { courierName: input.courierName, trackingNumber: input.trackingNumber } });
  await writeAudit(db, actor, { action: "order.shipping", entityType: "Order", entityId: orderId, metadata: input });
  return order;
}

export async function updateAdminNote(db: Db, actor: Actor, orderId: string, note: string | null) {
  assertPermission(actor, "order:update");
  await db.order.update({ where: { id: orderId }, data: { adminNote: note } });
  await writeAudit(db, actor, { action: "order.admin-note", entityType: "Order", entityId: orderId });
}

/** Record cash collected for a COD order. Idempotent through the unique payment transaction id. */
export async function markCodPaid(db: PrismaClient, actor: Actor, orderId: string) {
  assertPermission(actor, "order:update");
  return withTransaction(db, async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.paymentMethod !== "COD") throw new ConflictError("Only cash-on-delivery orders can be marked as collected.");
    if (order.paymentStatus === "PAID") return { changed: false };
    if (!["SHIPPED", "DELIVERED"].includes(order.status)) throw new ConflictError("Cash can be recorded once the order has been shipped or delivered.");
    if (order.paymentStatus !== "PENDING") throw new ConflictError("This order's payment status cannot be changed to paid.");
    await tx.payment.create({
      data: {
        orderId: order.id,
        method: "COD",
        status: "SUCCEEDED",
        amount: order.total,
        transactionId: `COD-${order.orderNumber}`,
        verifiedAt: new Date(),
      },
    });
    await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", paidAmount: order.total } });
    await writeAudit(tx, actor, { action: "order.cod-collected", entityType: "Order", entityId: order.id, metadata: { amount: order.total.toFixed(2) } });
    return { changed: true };
  });
}

/** Cancel online-payment orders that were not paid before paymentDueBy (releases reserved stock). */
export async function expireUnpaidOrders(db: PrismaClient, now = new Date()) {
  const expired = await db.order.findMany({
    where: { status: "PENDING", paymentMethod: "SSLCOMMERZ", paymentStatus: { in: ["PENDING", "FAILED"] }, paymentDueBy: { lt: now } },
    select: { id: true },
    take: 100,
  });
  let cancelled = 0;
  for (const { id } of expired) {
    try {
      const result = await cancelOrder(db, id, { type: "SYSTEM" }, "Payment not completed in time");
      if (result.changed) cancelled += 1;
    } catch (error) {
      console.error(`[orders] Failed to expire order ${id}`, error);
    }
  }
  return cancelled;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export type AdminOrderFilters = {
  q?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: "COD" | "SSLCOMMERZ";
  from?: Date | null;
  to?: Date | null;
  sort?: "newest" | "oldest" | "total-desc" | "total-asc";
  page: number;
  pageSize: number;
};

export function adminOrderWhere(filters: AdminOrderFilters): Prisma.OrderWhereInput {
  const q = filters.q?.trim();
  const phoneDigits = q?.replace(/\D/g, "");
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
    ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
    ...(filters.from || filters.to
      ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } }
      : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
            { customerEmail: { contains: q, mode: "insensitive" } },
            ...(phoneDigits && phoneDigits.length >= 4 ? [{ customerPhone: { contains: phoneDigits.slice(-10) } }] : []),
          ],
        }
      : {}),
  };
}

export async function listAdminOrders(db: Db, filters: AdminOrderFilters) {
  const where = adminOrderWhere(filters);
  const orderBy: Prisma.OrderOrderByWithRelationInput =
    filters.sort === "oldest"
      ? { createdAt: "asc" }
      : filters.sort === "total-desc"
        ? { total: "desc" }
        : filters.sort === "total-asc"
          ? { total: "asc" }
          : { createdAt: "desc" };
  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: [orderBy, { id: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        total: true,
        createdAt: true,
        shippingDistrict: true,
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return { rows, total };
}

export const orderDetailInclude = {
  items: { orderBy: { createdAt: "asc" } },
  statusHistory: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, email: true } } } },
  payments: { orderBy: { createdAt: "asc" } },
  refunds: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } } } },
  returnRequests: { orderBy: { createdAt: "desc" }, include: { items: true } },
  user: { select: { id: true, name: true, email: true } },
  notifications: { orderBy: { createdAt: "desc" }, take: 20 },
} satisfies Prisma.OrderInclude;

export async function getAdminOrder(db: Db, id: string) {
  return db.order.findUnique({ where: { id }, include: orderDetailInclude });
}

export const customerOrderInclude = {
  items: { orderBy: { createdAt: "asc" } },
  statusHistory: { orderBy: { createdAt: "asc" }, select: { toStatus: true, createdAt: true, note: true, actorType: true } },
  returnRequests: { orderBy: { createdAt: "desc" }, include: { items: true } },
  payments: { orderBy: { createdAt: "desc" }, select: { status: true, method: true, createdAt: true } },
} satisfies Prisma.OrderInclude;

/** A signed-in customer's own order (IDOR-safe: scoped by userId). */
export async function getCustomerOrder(db: Db, userId: string, orderNumber: string) {
  return db.order.findFirst({ where: { orderNumber, userId }, include: customerOrderInclude });
}

export async function getOrderByNumber(db: Db, orderNumber: string) {
  return db.order.findUnique({ where: { orderNumber }, include: customerOrderInclude });
}

/** Guest tracking: order number AND phone must both match. */
export async function trackOrder(db: Db, orderNumber: string, phone: string) {
  return db.order.findFirst({
    where: { orderNumber, customerPhone: phone },
    select: {
      orderNumber: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      createdAt: true,
      shippedAt: true,
      deliveredAt: true,
      courierName: true,
      trackingNumber: true,
      total: true,
      shippingDistrict: true,
      statusHistory: { orderBy: { createdAt: "asc" }, select: { toStatus: true, createdAt: true } },
      _count: { select: { items: true } },
    },
  });
}
