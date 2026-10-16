import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/server/notifications";

const e = env();

const trustedOrigins = [
  e.BETTER_AUTH_URL,
  e.NEXT_PUBLIC_SITE_URL,
  ...(e.TRUSTED_ORIGINS ? e.TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean) : []),
];

/**
 * Better Auth handles password hashing (scrypt), sessions (httpOnly cookies),
 * email verification and password reset tokens. Store roles live on the user
 * record and cannot be set through any auth endpoint (input: false).
 */
export const auth = betterAuth({
  appName: "AKR Lifestyle",
  baseURL: e.BETTER_AUTH_URL,
  secret: e.BETTER_AUTH_SECRET,
  trustedOrigins: Array.from(new Set(trustedOrigins)),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: e.AUTH_REQUIRE_EMAIL_VERIFICATION,
    autoSignIn: !e.AUTH_REQUIRE_EMAIL_VERIFICATION,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(prisma, user, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(prisma, user, url);
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, input: false, defaultValue: "CUSTOMER" },
      isActive: { type: "boolean", required: false, input: false, defaultValue: true },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 300, max: 8 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/request-password-reset": { window: 900, max: 5 },
      "/reset-password": { window: 900, max: 10 },
      "/send-verification-email": { window: 900, max: 5 },
    },
  },
  advanced: {
    cookiePrefix: "akr",
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },
  databaseHooks: {
    session: {
      create: {
        // Deactivated accounts can never obtain a session.
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { isActive: true } });
          if (!user?.isActive) return false;
        },
        after: async (session) => {
          await prisma.user.update({ where: { id: session.userId }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
