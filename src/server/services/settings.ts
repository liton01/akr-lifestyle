import type { Prisma } from "@prisma/client";
import { ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
import { SETTINGS_GROUPS, SETTINGS_SCHEMAS, type SettingsGroup, type StoreSettings } from "@/lib/settings-schema";
import { writeAudit } from "@/server/audit";
import type { Db } from "@/server/db";
import { assertPermission } from "@/server/services/authz";

/** Load every settings group, merging stored values over defaults and dropping invalid data. */
export async function loadStoreSettings(db: Db): Promise<StoreSettings> {
  const rows = await db.setting.findMany({ where: { key: { in: SETTINGS_GROUPS } } });
  const result = structuredClone(DEFAULT_SETTINGS) as StoreSettings;
  for (const row of rows) {
    const group = row.key as SettingsGroup;
    const schema = SETTINGS_SCHEMAS[group];
    const merged = { ...DEFAULT_SETTINGS[group], ...(isRecord(row.value) ? row.value : {}) };
    const parsed = schema.safeParse(merged);
    if (parsed.success) {
      (result as Record<SettingsGroup, unknown>)[group] = parsed.data;
    } else {
      console.warn(`[settings] Stored "${group}" settings are invalid; using defaults.`);
    }
  }
  return result;
}

/**
 * Validate and persist one settings group. Callers must invalidate the settings cache
 * (see invalidateSettingsCache in src/server/cache.ts) after a successful update.
 */
export async function updateSettingsGroup<G extends SettingsGroup>(
  db: Db,
  actor: Actor,
  group: G,
  input: unknown,
): Promise<StoreSettings[G]> {
  assertPermission(actor, "settings:write");
  const schema = SETTINGS_SCHEMAS[group];
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    throw new ValidationError("Please correct the highlighted settings.", fieldErrors);
  }
  const value = parsed.data as Prisma.InputJsonValue;
  await db.setting.upsert({
    where: { key: group },
    create: { key: group, value, updatedById: actor.id },
    update: { value, updatedById: actor.id },
  });
  await writeAudit(db, actor, { action: "settings.update", entityType: "Setting", entityId: group });
  return parsed.data as StoreSettings[G];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
