import { hmacBase64Url, safeEqual } from "@/server/crypto";
import { env, siteUrl } from "@/server/env";

/**
 * Receipt links let guests view their own order without an account. The token is an HMAC
 * of the order id, so it is unguessable, needs no storage, and can be recomputed for
 * retried submissions and emails. Rotating BETTER_AUTH_SECRET invalidates old links.
 */
export function orderAccessToken(orderId: string): string {
  return hmacBase64Url(env().BETTER_AUTH_SECRET, `order-receipt:${orderId}`).slice(0, 32);
}

export function verifyOrderAccessToken(orderId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  return safeEqual(orderAccessToken(orderId), token);
}

export function orderReceiptPath(orderNumber: string, orderId: string): string {
  return `/order/${encodeURIComponent(orderNumber)}?token=${orderAccessToken(orderId)}`;
}

export function orderReceiptUrl(orderNumber: string, orderId: string): string {
  return siteUrl(orderReceiptPath(orderNumber, orderId));
}
