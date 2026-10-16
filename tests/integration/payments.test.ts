import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { FetchLike, SslcommerzConfig } from "@/server/payments/sslcommerz";
import { placeOrder } from "@/server/services/orders";
import { confirmGatewayPayment, initiateOnlinePayment } from "@/server/services/payments";
import { checkoutInput, createProduct, fillCart, guestOwner, resetDatabase, seedBasics, SETTINGS } from "./helpers";

const db = new PrismaClient();
afterAll(() => db.$disconnect());

const config: SslcommerzConfig = { storeId: "teststore", storePassword: "testpass", sandbox: true };

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

async function onlineOrder() {
  const { child } = await seedBasics(db);
  const { variant } = await createProduct(db, { categoryId: child.id, price: 1500, stock: 5 });
  const owner = guestOwner();
  await fillCart(db, owner, [{ variantId: variant.id, quantity: 1 }]);
  const { order } = await placeOrder(db, checkoutInput({ paymentMethod: "SSLCOMMERZ", email: "buyer@test.local" }), {
    userId: null,
    owner,
    settings: SETTINGS,
    onlinePaymentAvailable: true,
  });
  return order;
}

describe("online payment verification", () => {
  beforeEach(() => resetDatabase(db));

  it("creates a gateway session and records an initiated payment", async () => {
    const order = await onlineOrder();
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      return jsonResponse({ status: "SUCCESS", GatewayPageURL: "https://sandbox.sslcommerz.com/EasyCheckOut/abc", sessionkey: "abc" });
    };
    const url = await initiateOnlinePayment(db, order.id, { config, fetchImpl });
    expect(url).toBe("https://sandbox.sslcommerz.com/EasyCheckOut/abc");
    expect(calls[0]).toContain("/gwprocess/v4/api.php");
    const payment = await db.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.status).toBe("INITIATED");
  });

  it("refuses gateway URLs that are not on sslcommerz.com", async () => {
    const order = await onlineOrder();
    const fetchImpl: FetchLike = async () => jsonResponse({ status: "SUCCESS", GatewayPageURL: "https://evil.example/pay" });
    await expect(initiateOnlinePayment(db, order.id, { config, fetchImpl })).rejects.toThrow();
    expect((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("FAILED");
  });

  it("marks the order paid only after a VALID validation response, exactly once", async () => {
    const order = await onlineOrder();
    await initiateOnlinePayment(db, order.id, {
      config,
      fetchImpl: async () => jsonResponse({ status: "SUCCESS", GatewayPageURL: "https://sandbox.sslcommerz.com/x" }),
    });
    const payment = await db.payment.findFirstOrThrow({ where: { orderId: order.id } });
    let validations = 0;
    const validator: FetchLike = async () => {
      validations += 1;
      return jsonResponse({ status: "VALID", tran_id: payment.transactionId, val_id: "VAL1", amount: payment.amount.toFixed(2), currency_type: "BDT", currency_amount: payment.amount.toFixed(2), risk_level: "0" });
    };
    const first = await confirmGatewayPayment(db, { tranId: payment.transactionId, valId: "VAL1" }, { config, fetchImpl: validator });
    const second = await confirmGatewayPayment(db, { tranId: payment.transactionId, valId: "VAL1" }, { config, fetchImpl: validator });
    expect(first.outcome).toBe("PAID");
    expect(second.outcome).toBe("ALREADY_PAID");
    expect(validations).toBe(1);
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.paymentStatus).toBe("PAID");
    expect(saved.status).toBe("CONFIRMED");
    expect(saved.paidAmount.toFixed(2)).toBe(payment.amount.toFixed(2));
  });

  it("does not mark paid when the amount, currency or status do not match", async () => {
    const order = await onlineOrder();
    await initiateOnlinePayment(db, order.id, { config, fetchImpl: async () => jsonResponse({ status: "SUCCESS", GatewayPageURL: "https://sandbox.sslcommerz.com/x" }) });
    const payment = await db.payment.findFirstOrThrow({ where: { orderId: order.id } });

    const wrongAmount = await confirmGatewayPayment(db, { tranId: payment.transactionId, valId: "V" }, {
      config,
      fetchImpl: async () => jsonResponse({ status: "VALID", tran_id: payment.transactionId, amount: "1.00", currency_type: "BDT", currency_amount: "1.00" }),
    });
    expect(wrongAmount.outcome).toBe("MISMATCH");

    const invalid = await confirmGatewayPayment(db, { tranId: payment.transactionId, valId: "V" }, { config, fetchImpl: async () => jsonResponse({ status: "INVALID_TRANSACTION" }) });
    expect(invalid.outcome).toBe("INVALID");

    const unknown = await confirmGatewayPayment(db, { tranId: "NOPE", valId: "V" }, { config, fetchImpl: async () => jsonResponse({ status: "VALID" }) });
    expect(unknown.outcome).toBe("UNKNOWN_TRANSACTION");

    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.paymentStatus).not.toBe("PAID");
  });
});
