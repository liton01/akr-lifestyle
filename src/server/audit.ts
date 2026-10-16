import type { Prisma } from "@prisma/client";
import type { Actor } from "@/lib/permissions";
import type { Db } from "@/server/db";

export type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

/** Record a sensitive administrative operation. Never include secrets or password data. */
export async function writeAudit(db: Db, actor: Actor | null, input: AuditInput) {
  await db.auditLog.create({
    data: {
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
    },
  });
}

/** Shallow diff of two plain records, for audit metadata. Excluded keys are never recorded. */
export function diffRecords(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  exclude: readonly string[] = [],
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (exclude.includes(key)) continue;
    const from = normalise(before[key]);
    const to = normalise(after[key]);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}

function normalise(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toFixed" in value && typeof (value as { toFixed: unknown }).toFixed === "function") {
    return (value as { toFixed(dp: number): string }).toFixed(2);
  }
  return value ?? null;
}
