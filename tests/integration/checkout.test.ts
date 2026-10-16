import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { InsufficientStockError, PriceChangedError, ValidationError } from "@/lib/errors";
import { addCartItem, findCart, mergeGuestCart, updateCartItemQuantity } from "@/server/services/cart";
import { placeOrder } from "@/server/services/orders";
import { checkoutInput, createCustomer, createProduct, fillCart, guestOwner, resetDatabase, seedBasics, SETTINGS, stockOf } from "./helpers";

const db = new PrismaClient();
afterAll(() => db.$disconnect());

const ctx = (owner: ReturnType<typeof guestOwner>, userId: string | null = null) => ({ userId, owner, settings: SETTINGS, onlinePaymentAvailable: false });

describe("cart rules", () => {
  beforeEach(() => resetDatabase(db));

  it("prevents quantities above stock or the per-line maximum", async () => {
    const { child } = await seedBasics(db);
    const { variant } = await createProduct(db, { categoryId: child.id, price: 1000, stock: 3 });
    const owner = guestOwner();
    await addCartItem(db, owner, variant.id, 2, 10);
    await expect(addCartItem(db, owner, variant.id, 2, 10)).rejects.toBeInstanceOf(ValidationError);
    const cart = await findCart(db, owner);
    await expect(updateCartItemQuantity(db, owner, cart!.items[0]!.id, 4, 10)).rejects.toBeInstanceOf(ValidationError);
    await expect(updateCartItemQuantity(db, owner, cart!.items[0]!.id, 3, 2)).rejects.toBeInstanceOf(ValidationError);
    await updateCartItemQuantity(db, owner, cart!.items[0]!.id, 3, 10);
    expect((await findCart(db, owner))!.items[0]!.quantity).toBe(3);
  });

  it("rejects draft products and items from someone else's cart", async () => {
    const { child } = await seedBasics(db);
    const { variant: draft } = await createProduct(db, { categoryId: child.id, price: 1000, stock: 3, status: "DRAFT" });
    await expect(addCartItem(db, guestOwner(), draft.id, 1, 10)).rejects.toThrow();
    const { variant } = await createProduct(db, { categoryId: child.id, price: 1000, stock: 3 });
    const alice = guestOwner();
    await addCartItem(db, alice, variant.id, 1, 10);
    const aliceItem = (await findCart(db, alice))!.items[0]!;
    await expect(updateCartItemQuantity(db, guestOwner(), aliceItem.id, 2, 10)).rejects.toThrow();
  });

  it("merges a guest cart into the user's cart, capped at stock", async () => {
    const { child } = await seedBasics(db);
    const { variant } = await createProduct(db, { categoryId: child.id, price: 1000, stock: 4 });
    const user = await createCustomer(db);
    const guest = guestOwner();
    await addCartItem(db, { userId: user.id, guestTokenHash: null }, variant.id, 3, 10);
    await addCartItem(db, guest, variant.id, 3, 10);
    await mergeGuestCart(db, guest.guestTokenHash!, user.id, 10);
    const userCart = await findCart(db, { userId: user.id, guestTokenHash: null });
    expect(userCart!.items[0]!.quantity).toBe(4);
    expect(await findCart(db, guest)).toBeNull();
  });
});

describe("order placement", () => {
  beforeEach(() => resetDatabase(db));

  it("prices the order on the server and stores immutable snapshots", async () => {
    const { child } = await seedBasics(db);
    const { product, variant } = await createProduct(db, { categoryId: child.id, price: 2000, salePrice: 1800, stock: 5 });
    const owner = guestOwner();
    await fillCart(db, owner, [{ variantId: variant.id, quantity: 2 }]);
    const { order } = await placeOrder(db, checkoutInput({ district: "Dhaka" }), ctx(owner));
    expect(order.total).toBe(3600_00 + 70_00);

    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    expect(saved.subtotal.toFixed(2)).toBe("4000.00");
    expect(saved.itemDiscountTotal.toFixed(2)).toBe("400.00");
    expect(saved.deliveryFee.toFixed(2)).toBe("70.00");
    expect(saved.items[0]).toMatchObject({ quantity: 2, sku: variant.sku });
    expect(saved.items[0]!.originalUnitPrice.toFixed(2)).toBe("2000.00");
    expect(saved.items[0]!.finalUnitPrice.toFixed(2)).toBe("1800.00");
    expect(await stockOf(db, variant.id)).toBe(3);
    expect(await db.cartItem.count()).toBe(0);

    // Later price changes do not alter the historical order.
    await db.product.update({ where: { id: product.id }, data: { price: "9999.00", salePrice: null } });
    const again = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(again.finalUnitPrice.toFixed(2)).toBe("1800.00");
  });

  it("rejects a submission whose displayed total no longer matches the server total", async () => {
    const { child } = await seedBasics(db);
    const { variant } = await createProduct(db, { categoryId: child.id, price: 1000, stock: 5 });
    const owner = guestOwner();
    await fillCart(db, owner, [{ variantId: variant.id, quantity: 1 }]);
    await expect(placeOrder(db, checkoutInput({ expectedTotal: 1 }), ctx(owner))).rejects.toBeInstanceOf(PriceChangedError);
    expect(await stockOf(db, variant.id)).toBe(5);
    expect(await db.order.count()).toBe(0);
  });

  it("is idempotent: a duplicate submission returns the original order and deducts stock once", async () => {
    const { child } = await seedBasics(db);
    const { variant } = await createProduct(db, { categoryId: child.id, price: 1000, stock: 5 });
    const owner = guestOwner();
    await fillCart(db, owner, [{ variantId: variant.id, quantity: 2 }]);
    const input = checkoutInput();
    const [a, b] = await Promise.all([placeOrder(db, input, ctx(owner)), placeOrder(db, input, ctx(owner))]);
    expect(a.order.id).toBe(b.order.id);
    const retry = await placeOrder(db, input, ctx(owner));
    expect(retry.duplicate).toBe(true);
    expect(retry.order.id).toBe(a.order.id);
    expect(await db.order.count()).toBe(1);
    expect(await stockOf(db, variant.id)).toBe(3);
    expect(await db.inventoryMovement.count({ where: { type: "ORDER_PLACED" } })).toBe(1);
  });

  it("never oversells under concurrent checkouts", async () => {
    const { child } = await seedBasics(db);
    const { variant } = await createProduct(db, { categoryId: child.id, price: 1000, stock: 3 });
    const buyers = Array.from({ length: 8 }, () => guestOwner());
    for (const owner of buyers) await fillCart(db, owner, [{ variantId: variant.id, quantity: 1 }]);
    const results = await Promise.allSettled(buyers.map((owner, i) => placeOrder(db, checkoutInput({ phone: `0171234567${i}` }), ctx(owner))));
    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(succeeded).toHaveLength(3);
    expect(failed).toHaveLength(5);
    // Buyers either lose the race at the stock UPDATE or see zero stock when repricing — both are rejections.
    for (const f of failed) {
      const reason = (f as PromiseRejectedResult).reason;
      expect(reason instanceof InsufficientStockError || (reason instanceof ValidationError && /out of stock|available/i.test(reason.message))).toBe(true);
    }
    expect(await stockOf(db, variant.id)).toBe(0);
    expect(await db.inventoryMovement.count({ where: { type: "ORDER_PLACED" } })).toBe(3);
  });

  it("enforces coupon usage limits under concurrency and per customer", async () => {
    const { child } = await seedBasics(db);
    const { variant } = await createProduct(db, { categoryId: child.id, price: 1000, stock: 50 });
    await db.coupon.create({ data: { code: "ONCE2", type: "FIXED_AMOUNT", value: "100.00", usageLimit: 2, perCustomerLimit: 1 } });
    const buyers = Array.from({ length: 5 }, () => guestOwner());
    for (const owner of buyers) await fillCart(db, owner, [{ variantId: variant.id, quantity: 1 }], "ONCE2");
    const results = await Promise.allSettled(buyers.map((owner, i) => placeOrder(db, checkoutInput({ phone: `0181234567${i}`, couponCode: "ONCE2" }), ctx(owner))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const coupon = await db.coupon.findUniqueOrThrow({ where: { code: "ONCE2" } });
    expect(coupon.usedCount).toBe(2);
    expect(await db.couponUsage.count()).toBe(2);

    // The same customer (phone) cannot reuse a once-per-customer coupon.
    await db.coupon.update({ where: { code: "ONCE2" }, data: { usageLimit: null } });
    const repeat = guestOwner();
    await fillCart(db, repeat, [{ variantId: variant.id, quantity: 1 }], "ONCE2");
    const firstPhone = (await db.order.findFirstOrThrow({ where: { couponCode: "ONCE2" } })).customerPhone;
    await expect(placeOrder(db, checkoutInput({ phone: firstPhone, couponCode: "ONCE2" }), ctx(repeat))).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects expired coupons and applies valid ones on the server", async () => {
    const { child } = await seedBasics(db);
    const { variant } = await createProduct(db, { categoryId: child.id, price: 1000, stock: 10 });
    await db.coupon.create({ data: { code: "OLD", type: "PERCENTAGE", value: "10.00", endsAt: new Date(Date.now() - 1000) } });
    await db.coupon.create({ data: { code: "TEN", type: "PERCENTAGE", value: "10.00" } });
    const owner = guestOwner();
    await fillCart(db, owner, [{ variantId: variant.id, quantity: 2 }]);
    await expect(placeOrder(db, checkoutInput({ couponCode: "OLD" }), ctx(owner))).rejects.toThrow("This coupon has expired.");
    const { order } = await placeOrder(db, checkoutInput({ couponCode: "TEN", district: "Sylhet" }), ctx(owner));
    // 2 × ৳1000 − 10% = ৳1800 + ৳130 (outside Dhaka)
    expect(order.total).toBe(1930_00);
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item.couponDiscount.toFixed(2)).toBe("200.00");
  });

  it("refuses online payment when the gateway is not configured", async () => {
    const { child } = await seedBasics(db);
    const { variant } = await createProduct(db, { categoryId: child.id, price: 1000, stock: 10 });
    const owner = guestOwner();
    await fillCart(db, owner, [{ variantId: variant.id, quantity: 1 }]);
    await expect(placeOrder(db, checkoutInput({ paymentMethod: "SSLCOMMERZ", email: "a@b.com" }), ctx(owner))).rejects.toBeInstanceOf(ValidationError);
  });
});
