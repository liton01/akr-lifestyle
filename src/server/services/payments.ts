import type { PrismaClient } from "@prisma/client";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { parseMoney, toMinor } from "@/lib/money";
import { randomCode } from "@/server/crypto";
import { withTransaction } from "@/server/db";
import { env, isSslcommerzConfigured, siteUrl } from "@/server/env";
import {
  createSession,
  sanitizeGatewayPayload,
  validateTransaction,
  type FetchLike,
  type SslcommerzConfig,
} from "@/server/payments/sslcommerz";

export function sslcommerzConfig(): SslcommerzConfig | null {
  if (!isSslcommerzConfigured()) return null;
  const e = env();
  return { storeId: e.SSLCOMMERZ_STORE_ID!, storePassword: e.SSLCOMMERZ_STORE_PASSWORD!, sandbox: e.SSLCOMMERZ_SANDBOX };
}

/** Start (or retry) an online payment for an unpaid SSLCommerz order. Returns the gateway URL. */
export async function initiateOnlinePayment(
  db: PrismaClient,
  orderId: string,
  options: { config?: SslcommerzConfig | null; fetchImpl?: FetchLike; now?: Date } = {},
): Promise<string> {
  const config = options.config === undefined ? sslcommerzConfig() : options.config;
  if (!config) throw new AppError("Online payment is not configured for this store.", "PAYMENT_UNAVAILABLE", 503);
  const now = options.now ?? new Date();

  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: { select: { productName: true, quantity: true } } } });
  if (!order) throw new NotFoundError("Order not found.");
  if (order.paymentMethod !== "SSLCOMMERZ") throw new ConflictError("This order is not set up for online payment.");
  if (order.status === "CANCELLED") throw new ConflictError("This order was cancelled.");
  if (order.paymentStatus === "PAID") throw new ConflictError("This order is already paid.");
  if (order.paymentDueBy && order.paymentDueBy < now) throw new ConflictError("The payment window for this order has expired.");

  const tranId = `${order.orderNumber}-${randomCode(4)}`;
  const payment = await db.payment.create({
    data: { orderId: order.id, method: "SSLCOMMERZ", status: "INITIATED", amount: order.total, transactionId: tranId },
  });
  const address = order.shippingAddress as { addressLine?: string; area?: string; district?: string; postalCode?: string | null };

  try {
    const session = await createSession(
      config,
      {
        tranId,
        amount: order.total.toFixed(2),
        successUrl: siteUrl("/api/payments/sslcommerz/success"),
        failUrl: siteUrl("/api/payments/sslcommerz/fail"),
        cancelUrl: siteUrl("/api/payments/sslcommerz/cancel"),
        ipnUrl: siteUrl("/api/payments/sslcommerz/ipn"),
        customer: {
          name: order.customerName,
          email: order.customerEmail ?? "customer@example.com",
          phone: order.customerPhone,
          address: [address.addressLine, address.area].filter(Boolean).join(", ") || "Bangladesh",
          city: address.district ?? "Dhaka",
          postcode: address.postalCode ?? null,
        },
        productName: order.items.map((i) => i.productName).join(", "),
        productCategory: "Lifestyle",
        itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
        orderId: order.id,
      },
      options.fetchImpl,
    );
    await db.payment.update({ where: { id: payment.id }, data: { rawResponse: { sessionKey: session.sessionKey } } });
    return session.gatewayUrl;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: reason.slice(0, 300) } });
    console.error(`[payments] SSLCommerz session failed for ${order.orderNumber}: ${reason}`);
    throw new AppError("We could not start the online payment. Please try again or choose cash on delivery.", "PAYMENT_INIT_FAILED", 502);
  }
}

export type ConfirmOutcome = "PAID" | "ALREADY_PAID" | "INVALID" | "MISMATCH" | "UNKNOWN_TRANSACTION";

/**
 * Confirm a gateway payment using the provider's validation API. This is the ONLY path that
 * marks an online payment as paid; visiting the success URL alone never does.
 */
export async function confirmGatewayPayment(
  db: PrismaClient,
  input: { tranId: string; valId: string },
  options: { config?: SslcommerzConfig | null; fetchImpl?: FetchLike } = {},
): Promise<{ outcome: ConfirmOutcome; orderId: string | null; orderNumber: string | null }> {
  const config = options.config === undefined ? sslcommerzConfig() : options.config;
  if (!config) return { outcome: "INVALID", orderId: null, orderNumber: null };

  const payment = await db.payment.findUnique({ where: { transactionId: input.tranId }, include: { order: true } });
  if (!payment) return { outcome: "UNKNOWN_TRANSACTION", orderId: null, orderNumber: null };
  const ref = { orderId: payment.orderId, orderNumber: payment.order.orderNumber };
  if (payment.status === "SUCCEEDED") return { outcome: "ALREADY_PAID", ...ref };

  const validation = await validateTransaction(config, input.valId, options.fetchImpl);
  const statusOk = validation.status === "VALID" || validation.status === "VALIDATED";
  if (!statusOk) {
    await db.payment.updateMany({
      where: { id: payment.id, status: "INITIATED" },
      data: { status: "FAILED", failureReason: `Gateway validation status: ${validation.status}`, rawResponse: sanitizeGatewayPayload(validation) },
    });
    return { outcome: "INVALID", ...ref };
  }

  const currency = validation.currency_type ?? validation.currency;
  const paidMinor = parseMoney(validation.currency_amount ?? validation.amount ?? "");
  const expected = toMinor(payment.amount);
  if (validation.tran_id !== input.tranId || currency !== "BDT" || paidMinor !== expected) {
    await db.payment.update({
      where: { id: payment.id },
      data: { failureReason: "Validation mismatch (transaction, currency or amount).", rawResponse: sanitizeGatewayPayload(validation) },
    });
    console.error(`[payments] Validation mismatch for ${input.tranId}`);
    return { outcome: "MISMATCH", ...ref };
  }

  const risky = validation.risk_level === "1";
  const outcome = await withTransaction(db, async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "SUCCEEDED" } },
      data: {
        status: "SUCCEEDED",
        providerReference: input.valId,
        bankTransactionId: validation.bank_tran_id ?? null,
        cardType: validation.card_type ?? null,
        verifiedAt: new Date(),
        rawResponse: sanitizeGatewayPayload(validation),
        failureReason: null,
      },
    });
    if (claimed.count === 0) return "ALREADY_PAID" as const;

    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${payment.orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", paidAmount: payment.amount } });

    if (order.status === "CANCELLED") {
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          actorType: "SYSTEM",
          note: "Payment received after the order was cancelled — a refund is required.",
        },
      });
    } else if (order.status === "PENDING" && !risky) {
      await tx.order.update({ where: { id: order.id }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: "PENDING", toStatus: "CONFIRMED", actorType: "SYSTEM", note: "Online payment verified" },
      });
    } else if (risky) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          actorType: "SYSTEM",
          note: `Payment flagged by gateway (${validation.risk_title ?? "risk"}). Verify before confirming.`,
        },
      });
    }
    return "PAID" as const;
  });
  return { outcome, ...ref };
}

/** Record a failed/cancelled attempt (only called after the gateway signature was verified). */
export async function markGatewayAttempt(db: PrismaClient, tranId: string, status: "FAILED" | "CANCELLED", reason: string) {
  const payment = await db.payment.findUnique({ where: { transactionId: tranId }, select: { id: true, orderId: true, status: true } });
  if (!payment || payment.status !== "INITIATED") return payment?.orderId ?? null;
  await db.payment.update({ where: { id: payment.id }, data: { status, failureReason: reason.slice(0, 300) } });
  await db.order.updateMany({ where: { id: payment.orderId, paymentStatus: "PENDING" }, data: { paymentStatus: "FAILED" } });
  return payment.orderId;
}
