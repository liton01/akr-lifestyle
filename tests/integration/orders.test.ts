import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, InvalidTransitionError, ValidationError } from "@/lib/errors";
import { cancelOrder, expireUnpaidOrders, markCodPaid, placeOrder, updateOrderStatus } from "@/server/services/orders";
import { createReturnRequest, receiveReturn, recordRefund, reviewReturn } from "@/server/services/returns";
import { checkoutInput, createActor, createCustomer, createProduct, fillCart, guestOwner, resetDatabase, seedBasics, SETTINGS, stockOf } from "./helpers";

const db = new PrismaClient();
afterAll(() => db.$disconnect());

async function orderWith(quantity: number, opts: { userId?: string; stock?: number } = {}) {
  const { child } = await seedBasics(db);
  const { variant, product } = await createProduct(db, { categoryId: child.id, price: 1000, stock: opts.stock ?? 10 });
  const owner = opts.userId ? { userId: opts.userId, guestTokenHash: null } : guestOwner();
  await fillCart(db, owner, [{ variantId: variant.id, quantity }]);
  const { order } = await placeOrder(db, checkoutInput(), { userId: opts.userId ?? null, owner, settings: SETTINGS, onlinePaymentAvailable: false });
  return { order, variant, product };
}

describe("cancellation and stock restoration", () => {
  beforeEach(() => resetDatabase(db));

  it("restores stock and releases the coupon exactly once, even when retried concurrently", async () => {
    const admin = await createActor(db, "ADMIN");
    const { child } = await seedBasics(db);
    const { variant, product } = await createProduct(db, { categoryId: child.id, price: 1000, stock: 10 });
    await db.coupon.create({ data: { code: "C1", type: "FIXED_AMOUNT", value: "50.00" } });
    const owner = guestOwner();
    await fillCart(db, owner, [{ variantId: variant.id, quantity: 4 }]);
    const { order } = await placeOrder(db, checkoutInput({ couponCode: "C1" }), { userId: null, owner, settings: SETTINGS, onlinePaymentAvailable: false });
    expect(await stockOf(db, variant.id)).toBe(6);
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).soldCount).toBe(4);

    const results = await Promise.all([
      cancelOrder(db, order.id, { type: "STAFF", actor: admin }, "Customer request"),
      cancelOrder(db, order.id, { type: "STAFF", actor: admin }, "Customer request"),
      cancelOrder(db, order.id, { type: "SYSTEM" }, "Duplicate"),
    ]);
    expect(results.filter((r) => r.changed)).toHaveLength(1);
    expect(await stockOf(db, variant.id)).toBe(10);
    expect(await db.inventoryMovement.count({ where: { type: "ORDER_CANCELLED" } })).toBe(1);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: "C1" } })).usedCount).toBe(0);
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).soldCount).toBe(0);
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.status).toBe("CANCELLED");
    expect(saved.stockRestoredAt).not.toBeNull();
  });

  it("lets customers cancel only their own pending/confirmed orders", async () => {
    const customer = await createCustomer(db);
    const stranger = await createCustomer(db);
    const admin = await createActor(db, "ADMIN");
    const { order } = await orderWith(1, { userId: customer.id });
    await expect(cancelOrder(db, order.id, { type: "CUSTOMER", userId: stranger.id }, "x")).rejects.toThrow("Order not found.");
    await updateOrderStatus(db, admin, order.id, { status: "CONFIRMED" });
    await updateOrderStatus(db, admin, order.id, { status: "PROCESSING" });
    await expect(cancelOrder(db, order.id, { type: "CUSTOMER", userId: customer.id }, "x")).rejects.toBeInstanceOf(ConflictError);
  });

  it("follows the status state machine and records history", async () => {
    const admin = await createActor(db, "ADMIN");
    const inventoryManager = await createActor(db, "INVENTORY_MANAGER");
    const { order } = await orderWith(1);
    await expect(updateOrderStatus(db, admin, order.id, { status: "SHIPPED" })).rejects.toBeInstanceOf(InvalidTransitionError);
    await expect(updateOrderStatus(db, inventoryManager, order.id, { status: "CONFIRMED" })).rejects.toBeInstanceOf(ForbiddenError);
    for (const status of ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"] as const) {
      await updateOrderStatus(db, admin, order.id, { status, courierName: status === "SHIPPED" ? "Pathao" : undefined, trackingNumber: status === "SHIPPED" ? "PT123" : undefined });
    }
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { statusHistory: true } });
    expect(saved.status).toBe("DELIVERED");
    expect(saved.deliveredAt).not.toBeNull();
    expect(saved.trackingNumber).toBe("PT123");
    expect(saved.statusHistory.map((h) => h.toStatus)).toEqual(["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"]);
    await expect(cancelOrder(db, order.id, { type: "STAFF", actor: admin }, "late")).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("restores stock once when a shipped parcel is returned to sender", async () => {
    const admin = await createActor(db, "ADMIN");
    const { order, variant } = await orderWith(2);
    for (const status of ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "RETURNED"] as const) await updateOrderStatus(db, admin, order.id, { status });
    expect(await stockOf(db, variant.id)).toBe(10);
  });

  it("expires unpaid online orders and releases their stock", async () => {
    const { child } = await seedBasics(db);
    const { variant } = await createProduct(db, { categoryId: child.id, price: 1000, stock: 5 });
    const owner = guestOwner();
    await fillCart(db, owner, [{ variantId: variant.id, quantity: 2 }]);
    const { order } = await placeOrder(db, checkoutInput({ paymentMethod: "SSLCOMMERZ", email: "a@b.com" }), {
      userId: null,
      owner,
      settings: SETTINGS,
      onlinePaymentAvailable: true,
    });
    expect(await stockOf(db, variant.id)).toBe(3);
    expect(await expireUnpaidOrders(db, new Date())).toBe(0);
    const later = new Date(Date.now() + (SETTINGS.commerce.paymentTimeoutMinutes + 1) * 60_000);
    expect(await expireUnpaidOrders(db, later)).toBe(1);
    expect(await stockOf(db, variant.id)).toBe(5);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
  });
});

describe("payments, refunds and returns", () => {
  beforeEach(() => resetDatabase(db));

  it("records COD collection once and never refunds more than was paid", async () => {
    const admin = await createActor(db, "ADMIN");
    const { order } = await orderWith(2);
    await expect(markCodPaid(db, admin, order.id)).rejects.toBeInstanceOf(ConflictError); // not shipped yet
    for (const status of ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"] as const) await updateOrderStatus(db, admin, order.id, { status });
    expect((await markCodPaid(db, admin, order.id)).changed).toBe(true);
    expect((await markCodPaid(db, admin, order.id)).changed).toBe(false);
    const total = order.total;

    const key = randomUUID();
    await recordRefund(db, admin, { orderId: order.id, amount: 500_00, method: "BKASH", reference: "TX1", reason: "Partial", returnRequestId: null, idempotencyKey: key });
    const dup = await recordRefund(db, admin, { orderId: order.id, amount: 500_00, method: "BKASH", reference: "TX1", reason: "Partial", returnRequestId: null, idempotencyKey: key });
    expect(dup.duplicate).toBe(true);
    let saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.paymentStatus).toBe("PARTIALLY_REFUNDED");
    await expect(
      recordRefund(db, admin, { orderId: order.id, amount: total, method: "CASH", reference: null, reason: "Too much", returnRequestId: null, idempotencyKey: randomUUID() }),
    ).rejects.toBeInstanceOf(ValidationError);
    await recordRefund(db, admin, { orderId: order.id, amount: total - 500_00, method: "CASH", reference: null, reason: "Rest", returnRequestId: null, idempotencyKey: randomUUID() });
    saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.paymentStatus).toBe("REFUNDED");
    expect(await db.refund.count()).toBe(2);
  });

  it("restocks returned items exactly once and marks fully returned orders", async () => {
    const admin = await createActor(db, "ADMIN");
    const customer = await createCustomer(db);
    const { order, variant } = await orderWith(2, { userId: customer.id });
    for (const status of ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"] as const) await updateOrderStatus(db, admin, order.id, { status });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const options = { returnWindowDays: 7, timeZone: "Asia/Dhaka" };

    await expect(createReturnRequest(db, { type: "CUSTOMER", userId: customer.id }, { orderId: order.id, reason: "Wrong colour", items: [{ orderItemId: item.id, quantity: 3 }] }, options)).rejects.toBeInstanceOf(
      ValidationError,
    );
    const request = await createReturnRequest(db, { type: "CUSTOMER", userId: customer.id }, { orderId: order.id, reason: "Wrong colour", items: [{ orderItemId: item.id, quantity: 2 }] }, options);
    await expect(receiveReturn(db, admin, request.id, "all")).rejects.toBeInstanceOf(ConflictError); // must be approved first
    await reviewReturn(db, admin, request.id, "APPROVE", null);
    const [first, second] = await Promise.all([receiveReturn(db, admin, request.id, "all"), receiveReturn(db, admin, request.id, "all")]);
    expect([first.changed, second.changed].filter(Boolean)).toHaveLength(1);
    expect(await stockOf(db, variant.id)).toBe(10);
    expect(await db.inventoryMovement.count({ where: { type: "RETURN_RESTOCK" } })).toBe(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("RETURNED");
  });

  it("closes the return window after the configured days", async () => {
    const admin = await createActor(db, "ADMIN");
    const customer = await createCustomer(db);
    const { order } = await orderWith(1, { userId: customer.id });
    for (const status of ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"] as const) await updateOrderStatus(db, admin, order.id, { status });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    const now = new Date(Date.now() + 8 * 86_400_000);
    await expect(
      createReturnRequest(db, { type: "CUSTOMER", userId: customer.id }, { orderId: order.id, reason: "Changed my mind", items: [{ orderItemId: item.id, quantity: 1 }] }, { returnWindowDays: 7, timeZone: "Asia/Dhaka", now }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
