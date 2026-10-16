"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { idSchema, intSchema } from "@/lib/validation/common";
import { formToObject, runAction } from "@/server/action";
import { getSettings } from "@/server/cache";
import { getCartOwner } from "@/server/cart-session";
import { prisma } from "@/server/db";
import { enforceRateLimit, LIMITS } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { addCartItem, clearCart, removeCartItem, setCartCoupon, updateCartItemQuantity } from "@/server/services/cart";
import { buildQuote } from "@/server/services/quote";
import { findCart } from "@/server/services/cart";

async function limitCartWrites() {
  await enforceRateLimit(prisma, `cart:${await clientIp()}`, LIMITS.cartWrite[0], LIMITS.cartWrite[1]);
}

const addSchema = z.object({ variantId: idSchema, quantity: intSchema(1, 100), buyNow: z.string().optional() });

export async function addToCartAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let goToCheckout = false;
  const result = await runAction(async () => {
    const input = addSchema.parse(formToObject(formData));
    await limitCartWrites();
    const { commerce } = await getSettings();
    const owner = await getCartOwner({ create: true });
    await addCartItem(prisma, owner, input.variantId, input.quantity, commerce.maxQuantityPerLine);
    goToCheckout = input.buyNow === "1";
    refresh();
    return { ok: true, message: "Added to your cart." };
  });
  if (result.ok && goToCheckout) redirect("/checkout");
  return result;
}

const updateSchema = z.object({ itemId: idSchema, quantity: intSchema(0, 100) });

export async function updateCartItemAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const input = updateSchema.parse(formToObject(formData));
    await limitCartWrites();
    const { commerce } = await getSettings();
    const owner = await getCartOwner({ create: true });
    await updateCartItemQuantity(prisma, owner, input.itemId, input.quantity, commerce.maxQuantityPerLine);
    refresh();
    return { ok: true };
  });
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const itemId = idSchema.safeParse(formData.get("itemId"));
  if (!itemId.success) return;
  const owner = await getCartOwner({ create: true });
  await removeCartItem(prisma, owner, itemId.data).catch(() => undefined);
  refresh();
}

export async function clearCartAction(): Promise<void> {
  const owner = await getCartOwner({ create: true });
  await clearCart(prisma, owner);
  refresh();
}

const couponSchema = z.object({ code: z.string().trim().max(40) });

/** Validate a coupon against the current cart and remember it on the cart when valid. */
export async function applyCouponAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { code } = couponSchema.parse(formToObject(formData));
    const owner = await getCartOwner({ create: true });
    if (!code) {
      await setCartCoupon(prisma, owner, null);
      refresh();
      return { ok: true, message: "Coupon removed." };
    }
    await enforceRateLimit(prisma, `coupon:${await clientIp()}`, LIMITS.coupon[0], LIMITS.coupon[1]);
    const { commerce } = await getSettings();
    const cart = await findCart(prisma, owner);
    if (!cart || cart.items.length === 0) return { ok: false, message: "Add items to your cart before applying a coupon." };
    const quote = await buildQuote(prisma, {
      items: cart.items.map((i) => ({ id: i.id, variantId: i.variantId, quantity: i.quantity })),
      couponCode: code,
      district: null,
      customer: { userId: owner.userId, phone: null },
      freeDeliveryEnabled: commerce.freeDeliveryEnabled,
      maxPerLine: commerce.maxQuantityPerLine,
    });
    if (quote.couponError || !quote.coupon) return { ok: false, message: quote.couponError ?? "This coupon cannot be applied." };
    await setCartCoupon(prisma, owner, quote.coupon.code);
    refresh();
    return { ok: true, message: `Coupon ${quote.coupon.code} applied.` };
  });
}

export async function removeCouponAction(): Promise<void> {
  const owner = await getCartOwner({ create: true });
  await setCartCoupon(prisma, owner, null);
  refresh();
}
