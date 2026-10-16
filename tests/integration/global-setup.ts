import { execSync } from "node:child_process";
import { config as loadEnv } from "dotenv";
import { testDatabaseUrl } from "./test-db";

/** Apply all migrations to the test database once before the integration suite. */
export default function setup() {
  loadEnv({ quiet: true });
  process.env.DATABASE_URL_ORIGINAL = process.env.DATABASE_URL;
  const url = testDatabaseUrl();
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
