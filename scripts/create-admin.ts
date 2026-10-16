/**
 * Create or promote the first administrator from environment variables.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... npm run admin:create
 *   npm run admin:create -- --reset-password   (replace the existing password)
 *
 * Credentials are never hard-coded. Remove ADMIN_PASSWORD from the environment afterwards.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { bootstrapAdmin } from "../src/server/services/bootstrap";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Administrator";
  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (see .env.example).");
    process.exit(1);
  }
  const db = new PrismaClient();
  try {
    const result = await bootstrapAdmin(db, { email, password, name }, { resetPassword: process.argv.includes("--reset-password") });
    console.log(
      result.created
        ? `Administrator ${email} created.`
        : `User ${email} is now an administrator${result.passwordUpdated ? " (password updated)" : " (existing password kept)"}.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
