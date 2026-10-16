"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { canonicalDistrict } from "@/lib/constants";
import type { Totals } from "@/lib/pricing/engine";
import { normalizeBdPhone } from "@/lib/utils";
import { checkoutSchema } from "@/lib/validation/checkout";
import { formToObject, runAction } from "@/server/action";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { getCartOwner } from "@/server/cart-session";
import { prisma } from "@/server/db";
import { isSslcommerzConfigured } from "@/server/env";
import { notifyLowStock, notifyOrderPlaced, notifyOrderStatus } from "@/server/notifications";
import { enforceRateLimit, LIMITS } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { findCart } from "@/server/services/cart";
import { orderReceiptPath, verifyOrderAccessToken } from "@/server/services/order-access";
import { cancelOrder, placeOrder } from "@/server/services/orders";
import { initiateOnlinePayment } from "@/server/services/payments";
import { buildQuote } from "@/server/services/quote";

export type CheckoutQuote = {
  totals: Totals;
  couponCode: string | null;
  couponError: string | null;
  delivery: { zoneName: string | null; estimatedDays: string | null; freeDeliveryApplied: boolean; amountToFreeDelivery: number | null };
  issues: string[];
};

const quoteSchema = z.object({
  district: z.string().max(40).nullable(),
  couponCode: z.string().max(40).nullable(),
  phone: z.string().max(20).nullable(),
});

/** Recalculate the checkout summary on the server (used when the district or coupon changes). */
export async function quoteCheckoutAction(raw: { district: string | null; couponCode: string | null; phone: string | null }): Promise<CheckoutQuote | null> {
  const input = quoteSchema.safeParse(raw);
  if (!input.success) return null;
  const owner = await getCartOwner();
  const cart = await findCart(prisma, owner);
  if (!cart || cart.items.length === 0) return null;
  const { commerce } = await getSettings();
  const quote = await buildQuote(prisma, {
    items: cart.items.map((i) => ({ id: i.id, variantId: i.variantId, quantity: i.quantity })),
    couponCode: input.data.couponCode?.trim() || cart.couponCode,
    district: input.data.district ? canonicalDistrict(input.data.district) : null,
    customer: { userId: owner.userId, phone: input.data.phone ? normalizeBdPhone(input.data.phone) : null },
    freeDeliveryEnabled: commerce.freeDeliveryEnabled,
    maxPerLine: commerce.maxQuantityPerLine,
  });
  return {
    totals: quote.totals,
    couponCode: quote.coupon?.code ?? null,
    couponError: quote.couponError,
    delivery: {
      zoneName: quote.delivery.zone?.name ?? null,
      estimatedDays: quote.delivery.zone?.estimatedDays ?? null,
      freeDeliveryApplied: quote.delivery.freeDeliveryApplied,
      amountToFreeDelivery: quote.delivery.amountToFreeDelivery,
    },
    issues: quote.lines.filter((l) => l.issue).map((l) => `${l.productName}: ${l.issue}`),
  };
}

export async function placeOrderAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let destination: string | null = null;
  const result = await runAction(async () => {
    // Validate first: fixing a typo should not use up the customer's order attempts.
    const raw = formToObject(formData);
    checkoutSchema.parse(raw);
    const ip = await clientIp();
    await enforceRateLimit(prisma, `checkout:${ip}`, LIMITS.checkout[0], LIMITS.checkout[1], "Too many order attempts from this network. Please wait a few minutes and try again.");
    const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
    const owner = await getCartOwner({ create: true });
    const placed = await placeOrder(prisma, raw, {
      userId: user?.id ?? null,
      owner,
      settings,
      onlinePaymentAvailable: isSslcommerzConfigured(),
    });
    const { order } = placed;
    if (!placed.duplicate) {
      after(async () => {
        await notifyOrderPlaced(prisma, order.id);
        if (placed.lowStock.length) {
          await notifyLowStock(
            prisma,
            placed.lowStock.map((l) => ({ sku: l.sku, name: l.name, quantity: l.quantity, threshold: l.threshold })),
          );
        }
      });
    }
    const receipt = orderReceiptPath(order.orderNumber, order.id);
    if (order.paymentMethod === "SSLCOMMERZ" && order.paymentStatus !== "PAID" && order.status !== "CANCELLED") {
      try {
        destination = await initiateOnlinePayment(prisma, order.id);
      } catch {
        destination = `${receipt}&payment=error`;
      }
    } else {
      destination = `${receipt}&placed=1`;
    }
    return { ok: true };
  });
  if (result.ok && destination) redirect(destination);
  return result;
}

/** Retry an online payment for an unpaid order (receipt token or the owner's session required). */
export async function payOrderAction(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const token = String(formData.get("token") ?? "");
  const order = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true, userId: true, orderNumber: true } });
  if (!order) redirect("/");
  const user = await getCurrentUser();
  const allowed = verifyOrderAccessToken(order.id, token) || (user && order.userId === user.id);
  if (!allowed) redirect("/");
  const receipt = orderReceiptPath(order.orderNumber, order.id);
  let destination: string;
  try {
    destination = await initiateOnlinePayment(prisma, order.id);
  } catch {
    destination = `${receipt}&payment=error`;
  }
  redirect(destination);
}

/** Customers can cancel their own order while it is pending or confirmed. */
export async function cancelOwnOrderAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Please sign in to cancel your order." };
    const orderId = z.string().min(1).parse(formData.get("orderId"));
    const reason = z.string().trim().max(300).optional().parse(formData.get("reason") ?? undefined) || "Cancelled by customer";
    const result = await cancelOrder(prisma, orderId, { type: "CUSTOMER", userId: user.id }, reason);
    if (result.changed) after(() => notifyOrderStatus(prisma, orderId, "CANCELLED", reason));
    return { ok: true, message: "Your order has been cancelled." };
  });
}
