import { after } from "next/server";
import { prisma } from "@/server/db";
import { siteUrl } from "@/server/env";
import { notifyPaymentStatus } from "@/server/notifications";
import { verifyIpnSignature } from "@/server/payments/sslcommerz";
import { orderReceiptPath } from "@/server/services/order-access";
import { confirmGatewayPayment, markGatewayAttempt, sslcommerzConfig } from "@/server/services/payments";

export async function readGatewayForm(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded") && !contentType.includes("multipart/form-data")) return {};
  const form = await request.formData();
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") out[key] = value.slice(0, 2000);
  return out;
}

export function signatureValid(payload: Record<string, string>): boolean {
  const config = sslcommerzConfig();
  return Boolean(config && verifyIpnSignature(payload, config.storePassword));
}

async function receiptUrlForTransaction(tranId: string | undefined, payment: string) {
  if (!tranId) return siteUrl("/");
  const record = await prisma.payment.findUnique({ where: { transactionId: tranId }, select: { order: { select: { id: true, orderNumber: true } } } });
  if (!record) return siteUrl("/");
  return siteUrl(`${orderReceiptPath(record.order.orderNumber, record.order.id)}&payment=${payment}`);
}

/**
 * Validate a VALID/VALIDATED callback through the gateway's validation API and record it.
 * The browser redirect itself is never trusted.
 */
export async function handleSuccessfulCallback(payload: Record<string, string>) {
  const tranId = payload.tran_id;
  const valId = payload.val_id;
  if (!tranId || !valId) return { outcome: "INVALID" as const, tranId };
  const result = await confirmGatewayPayment(prisma, { tranId, valId });
  if (result.outcome === "PAID" && result.orderId) {
    const orderId = result.orderId;
    after(() => notifyPaymentStatus(prisma, orderId, true));
  }
  return { outcome: result.outcome, tranId };
}

export async function handleFailedCallback(payload: Record<string, string>, status: "FAILED" | "CANCELLED") {
  // Only a correctly signed callback may change our records.
  if (!payload.tran_id || !signatureValid(payload)) return;
  const orderId = await markGatewayAttempt(prisma, payload.tran_id, status, payload.error || payload.status || status);
  if (orderId && status === "FAILED") after(() => notifyPaymentStatus(prisma, orderId, false));
}

export { receiptUrlForTransaction };
