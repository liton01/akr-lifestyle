import { Prisma, type InventoryMovementType, type PrismaClient } from "@prisma/client";
import { InsufficientStockError, NotFoundError, ValidationError } from "@/lib/errors";
import { toMinor } from "@/lib/money";
import type { Actor } from "@/lib/permissions";
import { stockAdjustmentSchema } from "@/lib/validation/catalog";
import { writeAudit } from "@/server/audit";
import { withTransaction, type Db, type Tx } from "@/server/db";
import { assertPermission } from "@/server/services/authz";

/**
 * Inventory policy
 * ─────────────────
 * • Stock is DEDUCTED when an order is placed (same transaction as the order insert).
 *   For online payments the deduction acts as a reservation: unpaid orders are cancelled
 *   after the payment timeout and their stock is restored.
 * • Stock is RESTORED exactly once when an order is cancelled / returned undelivered
 *   (guarded by Order.stockRestoredAt) or when a return request is received
 *   (guarded by ReturnRequest.restockedAt).
 * • Every change writes an InventoryMovement. Order/return movements carry a unique
 *   dedupeKey, so a retried operation can never apply twice.
 * • Deductions use a conditional UPDATE … WHERE quantity >= n, which is atomic under
 *   concurrency; a CHECK constraint (quantity >= 0) is the final safety net.
 */

export type StockLine = { variantId: string; quantity: number; sku: string; productName: string };
export type LowStockHit = { variantId: string; sku: string; name: string; quantity: number; threshold: number };

function mergeLines(lines: StockLine[]): StockLine[] {
  const merged = new Map<string, StockLine>();
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const existing = merged.get(line.variantId);
    if (existing) existing.quantity += line.quantity;
    else merged.set(line.variantId, { ...line });
  }
  // Consistent lock order across transactions prevents deadlocks.
  return [...merged.values()].sort((a, b) => (a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0));
}

async function thresholdsFor(tx: Tx, variantIds: string[]): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map();
  const rows = await tx.$queryRaw<{ variantId: string; threshold: number }[]>`
    SELECT v."id" AS "variantId", COALESCE(i."lowStockThreshold", p."lowStockThreshold") AS "threshold"
    FROM "ProductVariant" v
    JOIN "Product" p ON p."id" = v."productId"
    LEFT JOIN "Inventory" i ON i."variantId" = v."id"
    WHERE v."id" IN (${Prisma.join(variantIds)})`;
  return new Map(rows.map((r) => [r.variantId, Number(r.threshold)]));
}

/** Deduct stock for an order. Must run inside the order's transaction. */
export async function deductStockForOrder(
  tx: Tx,
  orderId: string,
  lines: StockLine[],
  actorId: string | null,
): Promise<LowStockHit[]> {
  const merged = mergeLines(lines);
  const thresholds = await thresholdsFor(
    tx,
    merged.map((l) => l.variantId),
  );
  const lowStock: LowStockHit[] = [];

  for (const line of merged) {
    const rows = await tx.$queryRaw<{ quantity: number }[]>`
      UPDATE "Inventory"
      SET "quantity" = "quantity" - ${line.quantity}, "updatedAt" = now()
      WHERE "variantId" = ${line.variantId} AND "quantity" >= ${line.quantity}
      RETURNING "quantity"`;
    if (rows.length === 0) {
      const current = await tx.inventory.findUnique({ where: { variantId: line.variantId }, select: { quantity: true } });
      throw new InsufficientStockError(line.sku, current?.quantity ?? 0, line.productName);
    }
    const after = Number(rows[0]!.quantity);
    const before = after + line.quantity;
    await tx.inventoryMovement.create({
      data: {
        variantId: line.variantId,
        sku: line.sku,
        productName: line.productName,
        type: "ORDER_PLACED",
        quantityChange: -line.quantity,
        quantityBefore: before,
        quantityAfter: after,
        orderId,
        actorId,
        dedupeKey: `order:${orderId}:placed:${line.variantId}`,
      },
    });
    const threshold = thresholds.get(line.variantId) ?? 0;
    if (before > threshold && after <= threshold) {
      lowStock.push({ variantId: line.variantId, sku: line.sku, name: line.productName, quantity: after, threshold });
    }
  }
  return lowStock;
}

/** Put stock back. The caller guarantees this runs once (stockRestoredAt / restockedAt guards). */
export async function restoreStock(
  tx: Tx,
  lines: StockLine[],
  ref: {
    type: Extract<InventoryMovementType, "ORDER_CANCELLED" | "RETURN_RESTOCK">;
    orderId: string;
    returnRequestId?: string | null;
    actorId: string | null;
    reason?: string | null;
  },
) {
  const merged = mergeLines(lines);
  for (const line of merged) {
    const variant = await tx.productVariant.findUnique({ where: { id: line.variantId }, select: { id: true } });
    if (!variant) continue; // Variant deleted since the order — nothing to restock.
    const rows = await tx.$queryRaw<{ quantity: number }[]>`
      INSERT INTO "Inventory" ("id", "variantId", "quantity", "updatedAt")
      VALUES (${`inv_${line.variantId}`}, ${line.variantId}, ${line.quantity}, now())
      ON CONFLICT ("variantId") DO UPDATE
        SET "quantity" = "Inventory"."quantity" + ${line.quantity}, "updatedAt" = now()
      RETURNING "quantity"`;
    const after = Number(rows[0]!.quantity);
    const refId = ref.type === "RETURN_RESTOCK" ? ref.returnRequestId : ref.orderId;
    await tx.inventoryMovement.create({
      data: {
        variantId: line.variantId,
        sku: line.sku,
        productName: line.productName,
        type: ref.type,
        quantityChange: line.quantity,
        quantityBefore: after - line.quantity,
        quantityAfter: after,
        reason: ref.reason ?? null,
        orderId: ref.orderId,
        returnRequestId: ref.returnRequestId ?? null,
        actorId: ref.actorId,
        dedupeKey: `${ref.type === "RETURN_RESTOCK" ? "return" : "order"}:${refId}:restored:${line.variantId}`,
      },
    });
  }
}

/** Manual stock adjustment by authorised staff (delta or absolute). */
export async function adjustStock(db: PrismaClient, actor: Actor, raw: unknown) {
  assertPermission(actor, "inventory:adjust");
  const input = stockAdjustmentSchema.parse(raw);

  return withTransaction(db, async (tx) => {
    const variant = await tx.productVariant.findUnique({
      where: { id: input.variantId },
      select: { id: true, sku: true, name: true, product: { select: { name: true, lowStockThreshold: true } } },
    });
    if (!variant) throw new NotFoundError("Variant not found.");

    await tx.$executeRaw`
      INSERT INTO "Inventory" ("id", "variantId", "quantity", "updatedAt")
      VALUES (${`inv_${variant.id}`}, ${variant.id}, 0, now())
      ON CONFLICT ("variantId") DO NOTHING`;
    const locked = await tx.$queryRaw<{ quantity: number; lowStockThreshold: number | null }[]>`
      SELECT "quantity", "lowStockThreshold" FROM "Inventory" WHERE "variantId" = ${variant.id} FOR UPDATE`;
    const before = Number(locked[0]!.quantity);
    const after = input.mode === "SET" ? input.quantity : before + input.quantity;

    if (after < 0) {
      throw new ValidationError(`Stock cannot be negative. Current stock is ${before}.`, { quantity: ["Resulting stock would be negative."] });
    }
    if (after === before) throw new ValidationError("The adjustment does not change the stock level.", { quantity: ["No change."] });

    await tx.inventory.update({ where: { variantId: variant.id }, data: { quantity: after } });
    const movement = await tx.inventoryMovement.create({
      data: {
        variantId: variant.id,
        sku: variant.sku,
        productName: variant.product.name,
        type: "MANUAL_ADJUSTMENT",
        quantityChange: after - before,
        quantityBefore: before,
        quantityAfter: after,
        reason: input.reason,
        actorId: actor.id,
      },
    });
    await writeAudit(tx, actor, {
      action: "inventory.adjust",
      entityType: "ProductVariant",
      entityId: variant.id,
      metadata: { sku: variant.sku, before, after, reason: input.reason },
    });
    const threshold = locked[0]!.lowStockThreshold ?? variant.product.lowStockThreshold;
    const lowStock: LowStockHit[] =
      before > threshold && after <= threshold
        ? [{ variantId: variant.id, sku: variant.sku, name: variant.product.name, quantity: after, threshold }]
        : [];
    return { movement, before, after, lowStock };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export type StockFilter = "all" | "in" | "low" | "out";
export type InventorySort = "name" | "stock-asc" | "stock-desc" | "updated";

export type InventoryRow = {
  variantId: string;
  sku: string;
  variantName: string;
  isDefault: boolean;
  productId: string;
  productName: string;
  productStatus: string;
  categoryName: string | null;
  quantity: number;
  threshold: number;
  updatedAt: Date | null;
};

export function stockState(quantity: number, threshold: number): "out" | "low" | "in" {
  if (quantity <= 0) return "out";
  if (quantity <= threshold) return "low";
  return "in";
}

export async function listInventory(
  db: Db,
  options: { q?: string; stock?: StockFilter; categoryId?: string; sort?: InventorySort; page: number; pageSize: number },
): Promise<{ rows: InventoryRow[]; total: number }> {
  const conditions: Prisma.Sql[] = [Prisma.sql`p."status" <> 'ARCHIVED'`];
  if (options.q) {
    const like = `%${options.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conditions.push(Prisma.sql`(p."name" ILIKE ${like} OR v."sku" ILIKE ${like} OR p."sku" ILIKE ${like})`);
  }
  if (options.categoryId) conditions.push(Prisma.sql`p."categoryId" = ${options.categoryId}`);
  const qty = Prisma.sql`COALESCE(i."quantity", 0)`;
  const threshold = Prisma.sql`COALESCE(i."lowStockThreshold", p."lowStockThreshold")`;
  if (options.stock === "out") conditions.push(Prisma.sql`${qty} <= 0`);
  if (options.stock === "low") conditions.push(Prisma.sql`${qty} > 0 AND ${qty} <= ${threshold}`);
  if (options.stock === "in") conditions.push(Prisma.sql`${qty} > ${threshold}`);
  const where = Prisma.join(conditions, " AND ");

  const orderBy =
    options.sort === "stock-asc"
      ? Prisma.sql`${qty} ASC, p."name" ASC`
      : options.sort === "stock-desc"
        ? Prisma.sql`${qty} DESC, p."name" ASC`
        : options.sort === "updated"
          ? Prisma.sql`i."updatedAt" DESC NULLS LAST`
          : Prisma.sql`p."name" ASC, v."sortOrder" ASC`;

  const offset = (options.page - 1) * options.pageSize;
  const [rows, count] = await Promise.all([
    db.$queryRaw<InventoryRow[]>`
      SELECT v."id" AS "variantId", v."sku", v."name" AS "variantName", v."isDefault",
             p."id" AS "productId", p."name" AS "productName", p."status"::text AS "productStatus",
             c."name" AS "categoryName", ${qty}::int AS "quantity", ${threshold}::int AS "threshold", i."updatedAt"
      FROM "ProductVariant" v
      JOIN "Product" p ON p."id" = v."productId"
      LEFT JOIN "Inventory" i ON i."variantId" = v."id"
      LEFT JOIN "Category" c ON c."id" = p."categoryId"
      WHERE ${where} AND v."isActive" = true
      ORDER BY ${orderBy}
      LIMIT ${options.pageSize} OFFSET ${offset}`,
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS "count"
      FROM "ProductVariant" v
      JOIN "Product" p ON p."id" = v."productId"
      LEFT JOIN "Inventory" i ON i."variantId" = v."id"
      WHERE ${where} AND v."isActive" = true`,
  ]);
  return { rows: rows.map((r) => ({ ...r, quantity: Number(r.quantity), threshold: Number(r.threshold) })), total: Number(count[0]?.count ?? 0) };
}

export type InventorySummary = {
  skuCount: number;
  totalUnits: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  retailValue: number;
  costValue: number;
};

/** Counts and values over active (non-archived) products' active variants. Values in poisha. */
export async function inventorySummary(db: Db): Promise<InventorySummary> {
  const rows = await db.$queryRaw<
    { skuCount: bigint; totalUnits: bigint | null; inStock: bigint; lowStock: bigint; outOfStock: bigint; retailValue: Prisma.Decimal | null; costValue: Prisma.Decimal | null }[]
  >`
    SELECT
      COUNT(*) AS "skuCount",
      SUM(COALESCE(i."quantity", 0)) AS "totalUnits",
      COUNT(*) FILTER (WHERE COALESCE(i."quantity", 0) > COALESCE(i."lowStockThreshold", p."lowStockThreshold")) AS "inStock",
      COUNT(*) FILTER (WHERE COALESCE(i."quantity", 0) > 0 AND COALESCE(i."quantity", 0) <= COALESCE(i."lowStockThreshold", p."lowStockThreshold")) AS "lowStock",
      COUNT(*) FILTER (WHERE COALESCE(i."quantity", 0) <= 0) AS "outOfStock",
      SUM(COALESCE(i."quantity", 0) * COALESCE(v."price", p."price")) AS "retailValue",
      SUM(COALESCE(i."quantity", 0) * COALESCE(v."costPrice", p."costPrice", 0)) AS "costValue"
    FROM "ProductVariant" v
    JOIN "Product" p ON p."id" = v."productId"
    LEFT JOIN "Inventory" i ON i."variantId" = v."id"
    WHERE p."status" <> 'ARCHIVED' AND v."isActive" = true`;
  const row = rows[0];
  const toPoisha = (value: Prisma.Decimal | null | undefined) => (value ? toMinor(value) : 0);
  return {
    skuCount: Number(row?.skuCount ?? 0),
    totalUnits: Number(row?.totalUnits ?? 0),
    inStock: Number(row?.inStock ?? 0),
    lowStock: Number(row?.lowStock ?? 0),
    outOfStock: Number(row?.outOfStock ?? 0),
    retailValue: toPoisha(row?.retailValue),
    costValue: toPoisha(row?.costValue),
  };
}

export async function listMovements(
  db: Db,
  options: { variantId?: string; type?: InventoryMovementType; page: number; pageSize: number },
) {
  const where: Prisma.InventoryMovementWhereInput = {
    ...(options.variantId ? { variantId: options.variantId } : {}),
    ...(options.type ? { type: options.type } : {}),
  };
  const [rows, total] = await Promise.all([
    db.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      include: {
        actor: { select: { name: true, email: true } },
        order: { select: { id: true, orderNumber: true } },
        returnRequest: { select: { id: true, returnNumber: true } },
      },
    }),
    db.inventoryMovement.count({ where }),
  ]);
  return { rows, total };
}
