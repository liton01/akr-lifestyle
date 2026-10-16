import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { bootstrapAdmin } from "@/server/services/bootstrap";
import { setUserActive, setUserRole } from "@/server/services/customers";
import { adjustStock, inventorySummary, listInventory } from "@/server/services/inventory";
import { loadStoreSettings, updateSettingsGroup } from "@/server/services/settings";
import { createActor, createCustomer, createProduct, resetDatabase, seedBasics, stockOf } from "./helpers";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
import { hitRateLimit } from "@/server/rate-limit";

const db = new PrismaClient();
afterAll(() => db.$disconnect());

describe("inventory adjustments", () => {
  beforeEach(() => resetDatabase(db));

  it("adjusts stock with a reason, records the actor and never goes negative", async () => {
    const manager = await createActor(db, "INVENTORY_MANAGER");
    const { child } = await seedBasics(db);
    const { variant } = await createProduct(db, { categoryId: child.id, price: 100, stock: 5 });
    await adjustStock(db, manager, { variantId: variant.id, mode: "DELTA", quantity: "7", reason: "New shipment" });
    expect(await stockOf(db, variant.id)).toBe(12);
    await adjustStock(db, manager, { variantId: variant.id, mode: "SET", quantity: "3", reason: "Stock count" });
    expect(await stockOf(db, variant.id)).toBe(3);
    await expect(adjustStock(db, manager, { variantId: variant.id, mode: "DELTA", quantity: "-4", reason: "Damaged" })).rejects.toBeInstanceOf(ValidationError);
    await expect(adjustStock(db, manager, { variantId: variant.id, mode: "DELTA", quantity: "1", reason: "" })).rejects.toThrow();
    const movements = await db.inventoryMovement.findMany({ where: { variantId: variant.id, type: "MANUAL_ADJUSTMENT" }, orderBy: { createdAt: "asc" } });
    expect(movements.map((m) => [m.quantityBefore, m.quantityAfter, m.actorId])).toEqual([
      [5, 12, manager.id],
      [12, 3, manager.id],
    ]);
  });

  it("rejects adjustments from roles without permission, and the database refuses negative stock", async () => {
    const storeManager = await createActor(db, "STORE_MANAGER");
    const { child } = await seedBasics(db);
    const { variant } = await createProduct(db, { categoryId: child.id, price: 100, stock: 5 });
    await expect(adjustStock(db, storeManager, { variantId: variant.id, mode: "SET", quantity: "1", reason: "x x x" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(db.inventory.update({ where: { variantId: variant.id }, data: { quantity: -1 } })).rejects.toThrow();
  });

  it("reports low and out-of-stock items", async () => {
    const { child } = await seedBasics(db);
    await createProduct(db, { categoryId: child.id, price: 100, stock: 0 });
    await createProduct(db, { categoryId: child.id, price: 100, stock: 2 });
    await createProduct(db, { categoryId: child.id, price: 100, stock: 50 });
    const summary = await inventorySummary(db);
    expect(summary).toMatchObject({ skuCount: 3, totalUnits: 52, inStock: 1, lowStock: 1, outOfStock: 1, retailValue: 52 * 100_00 });
    expect((await listInventory(db, { stock: "low", page: 1, pageSize: 10 })).rows).toHaveLength(1);
    expect((await listInventory(db, { stock: "out", page: 1, pageSize: 10 })).rows).toHaveLength(1);
  });
});

describe("settings, accounts and rate limits", () => {
  beforeEach(() => resetDatabase(db));

  it("validates and persists settings; only administrators may change them", async () => {
    const admin = await createActor(db, "ADMIN");
    const manager = await createActor(db, "STORE_MANAGER");
    const next = { ...DEFAULT_SETTINGS.announcement, text: "Eid sale is live", enabled: true };
    await updateSettingsGroup(db, admin, "announcement", next);
    expect((await loadStoreSettings(db)).announcement.text).toBe("Eid sale is live");
    await expect(updateSettingsGroup(db, admin, "announcement", { ...next, linkUrl: "javascript:alert(1)" })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateSettingsGroup(db, manager, "announcement", next)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.auditLog.count({ where: { action: "settings.update" } })).toBe(1);
  });

  it("falls back to defaults when stored settings are invalid", async () => {
    await db.setting.create({ data: { key: "commerce", value: { returnWindowDays: "not a number" } } });
    expect((await loadStoreSettings(db)).commerce.returnWindowDays).toBe(DEFAULT_SETTINGS.commerce.returnWindowDays);
  });

  it("deactivates accounts (revoking sessions) and keeps at least one administrator", async () => {
    const admin = await createActor(db, "ADMIN");
    const customer = await createCustomer(db);
    await db.session.create({ data: { id: "s1", token: "t1", userId: customer.id, expiresAt: new Date(Date.now() + 86_400_000) } });
    await setUserActive(db, admin, customer.id, false);
    expect((await db.user.findUniqueOrThrow({ where: { id: customer.id } })).isActive).toBe(false);
    expect(await db.session.count({ where: { userId: customer.id } })).toBe(0);
    const other = await createActor(db, "ADMIN");
    await setUserRole(db, other, admin.id, "STORE_MANAGER");
    await expect(setUserRole(db, other, other.id, "CUSTOMER")).rejects.toThrow("You cannot change your own role.");
  });

  it("bootstraps an administrator only with a strong password", async () => {
    await expect(bootstrapAdmin(db, { email: "owner@test.local", password: "short", name: "Owner" })).rejects.toThrow();
    const result = await bootstrapAdmin(db, { email: "owner@test.local", password: "Str0ng-Passw0rd!", name: "Owner" });
    expect(result.created).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { email: "owner@test.local" }, include: { accounts: true } });
    expect(user.role).toBe("ADMIN");
    expect(user.accounts[0]!.password).not.toContain("Str0ng");
  });

  it("limits requests per window atomically", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => hitRateLimit(db, "test:key", 4, 60)));
    expect(results.filter((r) => r.allowed)).toHaveLength(4);
  });
});
