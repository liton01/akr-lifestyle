import { RateLimitError } from "@/lib/errors";
import type { Db } from "@/server/db";

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date };

/**
 * Fixed-window rate limiter backed by PostgreSQL, so limits hold across multiple
 * server instances. The upsert is a single atomic statement.
 */
export async function hitRateLimit(db: Db, key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "ApiRateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "ApiRateLimit"."resetAt" <= now() THEN 1 ELSE "ApiRateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "ApiRateLimit"."resetAt" <= now()
                       THEN now() + make_interval(secs => ${windowSeconds})
                       ELSE "ApiRateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  const count = Number(row?.count ?? 1);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt: row?.resetAt ?? new Date() };
}

export async function enforceRateLimit(db: Db, key: string, limit: number, windowSeconds: number, message?: string) {
  const result = await hitRateLimit(db, key, limit, windowSeconds);
  if (!result.allowed) throw new RateLimitError(message);
  return result;
}

export async function purgeExpiredRateLimits(db: Db): Promise<number> {
  const result = await db.apiRateLimit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 60_000) } } });
  return result.count;
}

/** Common limits (requests per window in seconds). */
export const LIMITS = {
  signIn: [8, 300],
  signUp: [5, 3600],
  passwordReset: [5, 900],
  // Per IP: mobile networks in Bangladesh often put many customers behind one address.
  checkout: [30, 600],
  coupon: [20, 600],
  cartWrite: [120, 60],
  trackOrder: [15, 600],
  contact: [5, 3600],
  upload: [60, 600],
  returnRequest: [5, 3600],
} as const satisfies Record<string, readonly [number, number]>;
