import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { can, type Actor, type Permission } from "@/lib/permissions";

/** Throws unless the actor holds the permission. Used by every privileged service function. */
export function assertPermission(actor: Actor | null | undefined, permission: Permission): asserts actor is Actor {
  if (!actor) throw new UnauthorizedError();
  if (!can(actor.role, permission)) throw new ForbiddenError();
}
