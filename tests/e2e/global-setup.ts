import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

/** Reset, migrate and seed the e2e database (must be a dedicated *test* database). */
export default async function globalSetup() {
  loadEnv({ quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is required for end-to-end tests.");
  const name = new URL(url).pathname.slice(1);
  if (!/test/i.test(name)) throw new Error(`Refusing to reset "${name}": the e2e database name must contain "test".`);
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD so the e2e admin can be bootstrapped.");

  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length) await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  } finally {
    await db.$disconnect();
  }
  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });
  // Drop cached data (settings/categories) from a previous run against an older seed.
  rmSync(".next/cache/fetch-cache", { recursive: true, force: true });
}
