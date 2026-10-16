import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { randomToken, sha256Hex } from "@/server/crypto";
import { prisma } from "@/server/db";
import { mergeGuestCart, type CartOwner } from "@/server/services/cart";

const CART_COOKIE = "akr_cart";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

async function readGuestToken(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  return value && TOKEN_PATTERN.test(value) ? value : null;
}

/**
 * Resolve the cart owner for the current request.
 * • Signed-in users own their cart by user id; any guest cart from the cookie is merged in.
 * • Guests are identified by a random token cookie (only its hash is stored in the database).
 * `create` may only be used in Server Actions / Route Handlers because it can set cookies.
 */
export async function getCartOwner(options: { create?: boolean } = {}): Promise<CartOwner> {
  const user = await getCurrentUser();
  const guestToken = await readGuestToken();

  if (user) {
    if (guestToken) {
      const { commerce } = await getSettings();
      await mergeGuestCart(prisma, sha256Hex(guestToken), user.id, commerce.maxQuantityPerLine).catch((error) => {
        console.error("[cart] Guest cart merge failed", error);
      });
      if (options.create) (await cookies()).delete(CART_COOKIE);
    }
    return { userId: user.id, guestTokenHash: null };
  }

  if (guestToken) return { userId: null, guestTokenHash: sha256Hex(guestToken) };
  if (!options.create) return { userId: null, guestTokenHash: null };

  const token = randomToken(32);
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return { userId: null, guestTokenHash: sha256Hex(token) };
}
