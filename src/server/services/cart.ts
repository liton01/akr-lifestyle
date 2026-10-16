import type { PrismaClient } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { withTransaction, type Db } from "@/server/db";
import { buildQuote, type CustomerIdentity, type Quote } from "@/server/services/quote";

/**
 * Carts belong either to a signed-in user (userId) or to a guest, identified by the
 * SHA-256 hash of a random token kept in an httpOnly cookie. Every item operation is
 * scoped to the caller's own cart, so item ids from other carts are rejected.
 */
export type CartOwner = { userId: string | null; guestTokenHash: string | null };

export async function findCart(db: Db, owner: CartOwner) {
  if (owner.userId) return db.cart.findUnique({ where: { userId: owner.userId }, include: { items: { orderBy: { createdAt: "asc" } } } });
  if (owner.guestTokenHash) {
    return db.cart.findUnique({ where: { guestTokenHash: owner.guestTokenHash }, include: { items: { orderBy: { createdAt: "asc" } } } });
  }
  return null;
}

async function getOrCreateCart(db: Db, owner: CartOwner) {
  if (owner.userId) {
    return db.cart.upsert({ where: { userId: owner.userId }, create: { userId: owner.userId }, update: {} });
  }
  if (owner.guestTokenHash) {
    return db.cart.upsert({ where: { guestTokenHash: owner.guestTokenHash }, create: { guestTokenHash: owner.guestTokenHash }, update: {} });
  }
  throw new ValidationError("Cart session missing. Please refresh the page.");
}

async function purchasableVariant(db: Db, variantId: string) {
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      isActive: true,
      inventory: { select: { quantity: true } },
      product: { select: { name: true, status: true, category: { select: { isActive: true } } } },
    },
  });
  if (!variant || !variant.isActive || variant.product.status !== "ACTIVE" || !variant.product.category.isActive) {
    throw new NotFoundError("This product is not available.");
  }
  return { stock: variant.inventory?.quantity ?? 0, name: variant.product.name };
}

function assertQuantity(quantity: number, stock: number, maxPerLine: number, name: string) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new ValidationError("Quantity must be at least 1.");
  if (stock <= 0) throw new ValidationError(`${name} is out of stock.`);
  if (quantity > stock) throw new ValidationError(`Only ${stock} of ${name} ${stock === 1 ? "is" : "are"} available.`);
  if (quantity > maxPerLine) throw new ValidationError(`You can order at most ${maxPerLine} of ${name}.`);
}

export async function addCartItem(db: Db, owner: CartOwner, variantId: string, quantity: number, maxPerLine: number) {
  const { stock, name } = await purchasableVariant(db, variantId);
  const cart = await getOrCreateCart(db, owner);
  const existing = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } } });
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  assertQuantity(nextQuantity, stock, maxPerLine, name);
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity: nextQuantity },
    update: { quantity: nextQuantity },
  });
  await db.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  return { cartId: cart.id, quantity: nextQuantity };
}

export async function updateCartItemQuantity(db: Db, owner: CartOwner, itemId: string, quantity: number, maxPerLine: number) {
  const cart = await findCart(db, owner);
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) throw new NotFoundError("Cart item not found.");
  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id: item.id } });
    return { removed: true };
  }
  const { stock, name } = await purchasableVariant(db, item.variantId);
  assertQuantity(quantity, stock, maxPerLine, name);
  await db.cartItem.update({ where: { id: item.id }, data: { quantity } });
  return { removed: false };
}

export async function removeCartItem(db: Db, owner: CartOwner, itemId: string) {
  const cart = await findCart(db, owner);
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) throw new NotFoundError("Cart item not found.");
  await db.cartItem.delete({ where: { id: item.id } });
}

export async function clearCart(db: Db, owner: CartOwner) {
  const cart = await findCart(db, owner);
  if (!cart) return;
  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  await db.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
}

export async function setCartCoupon(db: Db, owner: CartOwner, code: string | null) {
  const cart = await getOrCreateCart(db, owner);
  await db.cart.update({ where: { id: cart.id }, data: { couponCode: code ? code.trim().toUpperCase() : null } });
}

/**
 * Merge a guest cart into the signed-in user's cart after login. Quantities are added
 * and capped at available stock and the per-line maximum; the guest cart is deleted.
 */
export async function mergeGuestCart(db: PrismaClient, guestTokenHash: string, userId: string, maxPerLine: number) {
  return withTransaction(db, async (tx) => {
    const guest = await tx.cart.findUnique({ where: { guestTokenHash }, include: { items: true } });
    if (!guest) return { merged: 0 };
    const userCart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {}, include: { items: true } });
    let merged = 0;
    for (const item of guest.items) {
      const stockRow = await tx.inventory.findUnique({ where: { variantId: item.variantId }, select: { quantity: true } });
      const existing = userCart.items.find((i) => i.variantId === item.variantId);
      const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, stockRow?.quantity ?? 0, maxPerLine);
      if (quantity <= 0) continue;
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
        create: { cartId: userCart.id, variantId: item.variantId, quantity },
        update: { quantity },
      });
      merged += 1;
    }
    if (!userCart.couponCode && guest.couponCode) {
      await tx.cart.update({ where: { id: userCart.id }, data: { couponCode: guest.couponCode } });
    }
    await tx.cart.delete({ where: { id: guest.id } });
    return { merged };
  });
}

export type CartView = Quote & { cartId: string | null; couponCode: string | null; itemCount: number };

export async function getCartView(
  db: Db,
  owner: CartOwner,
  options: { district?: string | null; customer?: CustomerIdentity; freeDeliveryEnabled: boolean; maxPerLine: number },
): Promise<CartView> {
  const cart = await findCart(db, owner);
  const items = cart?.items ?? [];
  const quote = await buildQuote(db, {
    items: items.map((i) => ({ id: i.id, variantId: i.variantId, quantity: i.quantity })),
    couponCode: cart?.couponCode ?? null,
    district: options.district ?? null,
    customer: options.customer ?? { userId: owner.userId, phone: null },
    freeDeliveryEnabled: options.freeDeliveryEnabled,
    maxPerLine: options.maxPerLine,
  });
  return {
    ...quote,
    cartId: cart?.id ?? null,
    couponCode: cart?.couponCode ?? null,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

export async function cartItemCount(db: Db, owner: CartOwner): Promise<number> {
  if (!owner.userId && !owner.guestTokenHash) return 0;
  const result = await db.cartItem.aggregate({
    _sum: { quantity: true },
    where: { cart: owner.userId ? { userId: owner.userId } : { guestTokenHash: owner.guestTokenHash } },
  });
  return result._sum.quantity ?? 0;
}
