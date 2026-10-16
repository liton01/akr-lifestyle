import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Either the root client or an interactive-transaction client. */
export type Db = PrismaClient | Prisma.TransactionClient;
export type Tx = Prisma.TransactionClient;

const RETRYABLE_CODES = new Set(["P2034", "40001", "40P01"]);

function isRetryable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; meta?: { code?: string }; message?: string };
  if (e.code && RETRYABLE_CODES.has(e.code)) return true;
  if (e.meta?.code && RETRYABLE_CODES.has(e.meta.code)) return true;
  return typeof e.message === "string" && /deadlock detected|could not serialize access/i.test(e.message);
}

/**
 * Run an interactive transaction, retrying on deadlocks / serialization failures.
 * The callback must be safe to re-run (it is, because a failed attempt rolls back entirely).
 */
export async function withTransaction<T>(
  db: PrismaClient,
  fn: (tx: Tx) => Promise<T>,
  options: { maxAttempts?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      return await db.$transaction(fn, {
        timeout: options.timeout ?? 20_000,
        maxWait: 10_000,
        isolationLevel: options.isolationLevel,
      });
    } catch (error) {
      if (attempt < maxAttempts && isRetryable(error)) {
        await new Promise((resolve) => setTimeout(resolve, 25 * attempt + Math.floor(Math.random() * 50)));
        continue;
      }
      throw error;
    }
  }
}
