import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { Db } from "@/server/db";

const WEAK_PASSWORDS = new Set(["password", "password123", "admin123", "12345678", "123456789", "qwerty123", "changeme", "akrlifestyle"]);

/** Strong-password rule for the bootstrap administrator. Returns an error message or null. */
export function adminPasswordProblem(password: string | undefined): string | null {
  if (!password) return "ADMIN_PASSWORD is not set.";
  if (password.length < 12) return "ADMIN_PASSWORD must be at least 12 characters.";
  if (WEAK_PASSWORDS.has(password.toLowerCase())) return "ADMIN_PASSWORD is too common.";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) return "ADMIN_PASSWORD must mix at least three of: lowercase, uppercase, digits, symbols.";
  return null;
}

/**
 * Create the first administrator (or promote an existing user) using credentials supplied
 * through environment variables. The password is hashed with Better Auth's scrypt hasher,
 * exactly as a normal sign-up would store it. Existing passwords are only replaced when
 * resetPassword is true.
 */
export async function bootstrapAdmin(
  db: Db,
  input: { email: string; password: string; name: string },
  options: { resetPassword?: boolean } = {},
): Promise<{ userId: string; created: boolean; passwordUpdated: boolean }> {
  const problem = adminPasswordProblem(input.password);
  if (problem) throw new Error(problem);
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("ADMIN_EMAIL is not a valid email address.");

  const existing = await db.user.findUnique({ where: { email }, include: { accounts: { where: { providerId: "credential" } } } });
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN", isActive: true, emailVerified: true } });
    let passwordUpdated = false;
    const credential = existing.accounts[0];
    if (!credential) {
      await db.account.create({
        data: { id: randomUUID(), accountId: existing.id, providerId: "credential", userId: existing.id, password: await hashPassword(input.password) },
      });
      passwordUpdated = true;
    } else if (options.resetPassword) {
      await db.account.update({ where: { id: credential.id }, data: { password: await hashPassword(input.password) } });
      await db.session.deleteMany({ where: { userId: existing.id } });
      passwordUpdated = true;
    }
    return { userId: existing.id, created: false, passwordUpdated };
  }

  const userId = randomUUID();
  await db.user.create({
    data: {
      id: userId,
      email,
      name: input.name.trim() || "Administrator",
      emailVerified: true,
      role: "ADMIN",
      accounts: {
        create: { id: randomUUID(), accountId: userId, providerId: "credential", password: await hashPassword(input.password) },
      },
    },
  });
  return { userId, created: true, passwordUpdated: true };
}
