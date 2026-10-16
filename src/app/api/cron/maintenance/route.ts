import { safeEqual } from "@/server/crypto";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { purgeExpiredRateLimits } from "@/server/rate-limit";
import { expireUnpaidOrders } from "@/server/services/orders";

/**
 * Scheduled maintenance. Call every 5–15 minutes from a scheduler (cron, Vercel Cron,
 * GitHub Actions…) with header:  Authorization: Bearer <CRON_SECRET>
 *
 * • Cancels unpaid online-payment orders past their payment deadline (releases stock).
 * • Purges expired rate-limit counters and abandoned guest carts (> 60 days).
 */
async function run(request: Request) {
  const secret = env().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });

  const expiredOrders = await expireUnpaidOrders(prisma);
  const rateLimits = await purgeExpiredRateLimits(prisma);
  const carts = await prisma.cart.deleteMany({ where: { userId: null, updatedAt: { lt: new Date(Date.now() - 60 * 86_400_000) } } });
  const sessions = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return Response.json({ expiredOrders, rateLimits, guestCarts: carts.count, sessions: sessions.count });
}

export const GET = run;
export const POST = run;
