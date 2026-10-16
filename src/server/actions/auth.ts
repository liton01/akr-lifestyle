"use server";

import { isAPIError } from "better-auth/api";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { ValidationError } from "@/lib/errors";
import { isStaffRole } from "@/lib/permissions";
import { safeRedirectPath } from "@/lib/utils";
import { emailSchema, passwordSchema } from "@/lib/validation/common";
import { formToObject, runAction } from "@/server/action";
import { auth } from "@/server/auth/auth";
import { requireActionUser } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { sha256Hex } from "@/server/crypto";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { enforceRateLimit, LIMITS } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { mergeGuestCart } from "@/server/services/cart";
import { normalizeBdPhone } from "@/lib/utils";

function apiErrorCode(error: unknown): string | null {
  if (!isAPIError(error)) return null;
  const body = (error as { body?: { code?: string } }).body;
  return body?.code ?? null;
}

async function mergeCartAfterLogin(userId: string) {
  const store = await cookies();
  const token = store.get("akr_cart")?.value;
  if (!token) return;
  const { commerce } = await getSettings();
  await mergeGuestCart(prisma, sha256Hex(token), userId, commerce.maxQuantityPerLine).catch((error) => console.error("[auth] cart merge failed", error));
  store.delete("akr_cart");
}

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
  next: z.string().optional(),
});

export async function signInAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let destination = "/account";
  const result = await runAction(async () => {
    const input = signInSchema.parse(formToObject(formData));
    const ip = await clientIp();
    await enforceRateLimit(prisma, `signin:ip:${ip}`, LIMITS.signIn[0] * 3, LIMITS.signIn[1]);
    await enforceRateLimit(prisma, `signin:email:${input.email}`, LIMITS.signIn[0], LIMITS.signIn[1], "Too many sign-in attempts. Please wait a few minutes.");

    const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { isActive: true } });
    if (existing && !existing.isActive) {
      return { ok: false, message: "This account is unavailable. Please contact customer care." };
    }

    try {
      const response = await auth.api.signInEmail({
        body: { email: input.email, password: input.password, rememberMe: true },
        headers: await headers(),
      });
      const user = await prisma.user.findUnique({ where: { id: response.user.id }, select: { id: true, role: true } });
      if (user) await mergeCartAfterLogin(user.id);
      destination = safeRedirectPath(input.next, user && isStaffRole(user.role) ? "/admin" : "/account");
      return { ok: true };
    } catch (error) {
      const code = apiErrorCode(error);
      if (code === "EMAIL_NOT_VERIFIED") {
        return { ok: false, message: "Please verify your email address first. We have sent you a new verification link." };
      }
      if (code) return { ok: false, message: "Incorrect email or password." };
      throw error;
    }
  });
  if (result.ok) redirect(destination);
  return result;
}

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(100),
    email: emailSchema,
    phone: z
      .string()
      .trim()
      .optional()
      .transform((value, ctx) => {
        if (!value) return null;
        const normalized = normalizeBdPhone(value);
        if (!normalized) {
          ctx.addIssue({ code: "custom", message: "Enter a valid Bangladeshi mobile number." });
          return z.NEVER;
        }
        return normalized;
      }),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal("on", { message: "Please accept the terms and privacy policy." }),
    next: z.string().optional(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export async function registerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let destination: string | null = null;
  const result = await runAction(async () => {
    const input = registerSchema.parse(formToObject(formData));
    const ip = await clientIp();
    await enforceRateLimit(prisma, `signup:ip:${ip}`, LIMITS.signUp[0], LIMITS.signUp[1], "Too many sign-up attempts. Please try again later.");
    try {
      const response = await auth.api.signUpEmail({
        body: { name: input.name, email: input.email, password: input.password, callbackURL: "/account?verified=1" },
        headers: await headers(),
      });
      await prisma.customerProfile.upsert({
        where: { userId: response.user.id },
        create: { userId: response.user.id, phone: input.phone },
        update: { phone: input.phone },
      });
      if (env().AUTH_REQUIRE_EMAIL_VERIFICATION) {
        return { ok: true, message: "Account created. Please check your email and click the verification link to sign in." };
      }
      await mergeCartAfterLogin(response.user.id);
      destination = safeRedirectPath(input.next, "/account?welcome=1");
      return { ok: true };
    } catch (error) {
      const code = apiErrorCode(error);
      if (code?.startsWith("USER_ALREADY_EXISTS")) {
        throw new ValidationError("An account with this email already exists.", { email: ["Try signing in or resetting your password."] });
      }
      if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
        throw new ValidationError("Choose a password between 8 and 128 characters.", { password: ["Invalid length."] });
      }
      throw error;
    }
  });
  if (result.ok && destination) redirect(destination);
  return result;
}

export async function signOutAction() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Already signed out.
  }
  redirect("/");
}

export async function requestPasswordResetAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { email } = z.object({ email: emailSchema }).parse(formToObject(formData));
    const ip = await clientIp();
    await enforceRateLimit(prisma, `reset:ip:${ip}`, LIMITS.passwordReset[0] * 2, LIMITS.passwordReset[1]);
    await enforceRateLimit(prisma, `reset:email:${email}`, LIMITS.passwordReset[0], LIMITS.passwordReset[1]);
    try {
      await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: await headers() });
    } catch (error) {
      // Never reveal whether an account exists.
      if (!isAPIError(error)) throw error;
    }
    return { ok: true, message: "If an account exists for that email, we have sent a password reset link. It expires in 1 hour." };
  });
}

const resetSchema = z
  .object({ token: z.string().min(10, "This reset link is invalid."), password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const input = resetSchema.parse(formToObject(formData));
    try {
      await auth.api.resetPassword({ body: { newPassword: input.password, token: input.token }, headers: await headers() });
      return { ok: true };
    } catch (error) {
      if (apiErrorCode(error)) return { ok: false, message: "This reset link is invalid or has expired. Please request a new one." };
      throw error;
    }
  });
  if (result.ok) redirect("/login?reset=1");
  return result;
}

const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password."), password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionUser();
    const input = changePasswordSchema.parse(formToObject(formData));
    try {
      await auth.api.changePassword({
        body: { currentPassword: input.currentPassword, newPassword: input.password, revokeOtherSessions: true },
        headers: await headers(),
      });
      return { ok: true, message: "Your password has been changed. Other devices have been signed out." };
    } catch (error) {
      if (apiErrorCode(error)) return { ok: false, message: "Your current password is incorrect.", fieldErrors: { currentPassword: ["Incorrect password."] } };
      throw error;
    }
  });
}

export async function resendVerificationAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    if (user.emailVerified) return { ok: true, message: "Your email is already verified." };
    await enforceRateLimit(prisma, `verify:${user.id}`, 3, 900);
    await auth.api.sendVerificationEmail({ body: { email: user.email, callbackURL: "/account?verified=1" }, headers: await headers() });
    return { ok: true, message: "We have sent a new verification link to your email." };
  });
}
