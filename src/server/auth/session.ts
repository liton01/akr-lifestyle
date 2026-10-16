import "server-only";
import type { Role } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { can, isStaffRole, type Actor, type Permission } from "@/lib/permissions";
import { auth } from "@/server/auth/auth";

export type CurrentUser = Actor & { emailVerified: boolean; image: string | null };

/** Session for the current request (memoised per request). */
export const getSession = cache(async () => {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
});

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const user = session.user as typeof session.user & { role?: Role; isActive?: boolean };
  if (user.isActive === false) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role ?? "CUSTOMER",
    emailVerified: user.emailVerified,
    image: user.image ?? null,
  };
});

/** For pages: redirect anonymous visitors to the login page. */
export async function requireUserPage(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** For admin pages: require a staff role holding `permission`. */
export async function requireStaffPage(permission: Permission, nextPath = "/admin"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!isStaffRole(user.role)) redirect("/");
  if (!can(user.role, permission)) redirect("/admin/access-denied");
  return user;
}

/** For server actions: throws instead of redirecting. */
export async function requireActionUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireActionPermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireActionUser();
  if (!can(user.role, permission)) throw new ForbiddenError();
  return user;
}
