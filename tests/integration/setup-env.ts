import { config as loadEnv } from "dotenv";
import { testDatabaseUrl } from "./test-db";

// Point every Prisma client created in the test process at the test database.
loadEnv({ quiet: true });
process.env.DATABASE_URL_ORIGINAL = process.env.DATABASE_URL;
process.env.DATABASE_URL = testDatabaseUrl();
process.env.EMAIL_PROVIDER = "console";
process.env.SMS_PROVIDER = "none";
process.env.STORE_NOTIFICATION_EMAIL = "";
