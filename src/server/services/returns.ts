import type { PaymentStatus, PrismaClient, RefundMethod } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "@/lib/errors";
import { fromMinor, toMinor } from "@/lib/money";
import type { Actor } from "@/lib/permissions";
import { returnRequestSchema } from "@/lib/validation/checkout";
import { writeAudit } from "@/server/audit";
import { randomCode } from "@/server/crypto";
import { withTransaction, type Db } from "@/server/db";
import { assertPermission } from "@/server/services/authz";
import { zonedParts } from "@/server/services/dates";
import { restoreStock } from "@/server/services/inventory";

const OPEN_RETURN_STATUSES = ["REQUESTED", "APPROVED"] as const;

function returnNumber(now: Date, timeZone: string) {
  const p = zonedParts(now, timeZone);
  return `RET${String(p.year).slice(-2)}${String(p.month).padStart(2, "0")}${String(p.day).padStart(2, "0")}-${randomCode(4)}`;
}

/** Customer (or staff on their behalf) requests a return for delivered items within the return window. */
export async function createReturnRequest(
  db: PrismaClient,
  requester: { type: "CUSTOMER"; userId: string } | { type: "STAFF"; actor: Actor },
  raw: unknown,
  options: { returnWindowDays: number; timeZone: string; now?: Date },
) {
  const input = returnRequestSchema.parse(raw);
  if (requester.type === "STAFF") assertPermission(requester.actor, "order:update");
  const now = options.now ?? new Date();

  return withTransaction(db, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { items: true, returnRequests: { where: { status: { in: [...OPEN_RETURN_STATUSES] } }, include: { items: true } } },
    });
    if (!order || (requester.type === "CUSTOMER" && order.userId !== requester.userId)) throw new NotFoundError("Order not found.");
    if (order.status !== "DELIVERED") throw new ConflictError("Returns can be requested only for delivered orders.");
    if (requester.type === "CUSTOMER") {
      const deadline = order.deliveredAt ? order.deliveredAt.getTime() + options.returnWindowDays * 86_400_000 : 0;
      if (now.getTime() > deadline) throw new ConflictError(`The ${options.returnWindowDays}-day return window for this order has closed.`);
    }

    const pending = new Map<string, number>();
    for (const request of order.returnRequests) {
      for (const item of request.items) pending.set(item.orderItemId, (pending.get(item.orderItemId) ?? 0) + item.quantity);
    }
    const seen = new Set<string>();
    for (const line of input.items) {
      if (seen.has(line.orderItemId)) throw new ValidationError("Each item can be listed once.");
      seen.add(line.orderItemId);
      const item = order.items.find((i) => i.id === line.orderItemId);
      if (!item) throw new ValidationError("An item does not belong to this order.");
      const returnable = item.quantity - item.returnedQuantity - (pending.get(item.id) ?? 0);
      if (line.quantity > returnable) {
        throw new ValidationError(`You can return at most ${Math.max(returnable, 0)} of ${item.productName}.`);
      }
    }

    const request = await tx.returnRequest.create({
      data: {
        returnNumber: returnNumber(now, options.timeZone),
        orderId: order.id,
        userId: order.userId,
        reason: input.reason,
        items: { create: input.items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })) },
      },
    });
    if (requester.type === "STAFF") {
      await writeAudit(tx, requester.actor, { action: "return.create", entityType: "ReturnRequest", entityId: request.id, metadata: { orderId: order.id } });
    }
    return request;
  });
}

export async function reviewReturn(db: Db, actor: Actor, id: string, decision: "APPROVE" | "REJECT", note: string | null) {
  assertPermission(actor, "order:update");
  const request = await db.returnRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError("Return request not found.");
  if (decision === "APPROVE" && request.status !== "REQUESTED") throw new ConflictError("Only new requests can be approved.");
  if (decision === "REJECT" && !["REQUESTED", "APPROVED"].includes(request.status)) throw new ConflictError("This request can no longer be rejected.");
  const updated = await db.returnRequest.update({
    where: { id },
    data: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED", adminNote: note, resolvedAt: decision === "REJECT" ? new Date() : null },
  });
  await writeAudit(db, actor, { action: decision === "APPROVE" ? "return.approve" : "return.reject", entityType: "ReturnRequest", entityId: id, metadata: { note } });
  return updated;
}

/**
 * Mark returned goods as received. Items flagged `restock` go back into inventory exactly
 * once (guarded by restockedAt). When every unit of the order has been returned, the order
 * becomes RETURNED.
 */
export async function receiveReturn(db: PrismaClient, actor: Actor, id: string, restockItemIds: string[] | "all") {
  assertPermission(actor, "order:update");
  return withTransaction(db, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ReturnRequest" WHERE "id" = ${id} FOR UPDATE`;
    const request = await tx.returnRequest.findUnique({ where: { id }, include: { items: { include: { orderItem: true } }, order: true } });
    if (!request) throw new NotFoundError("Return request not found.");
    if (request.status === "RECEIVED" || request.status === "CLOSED") return { changed: false };
    if (request.status !== "APPROVED") throw new ConflictError("Approve the return before receiving it.");

    const claimed = await tx.returnRequest.updateMany({ where: { id, restockedAt: null }, data: { restockedAt: new Date(), status: "RECEIVED" } });
    if (claimed.count === 0) return { changed: false };

    const restockSet = restockItemIds === "all" ? null : new Set(restockItemIds);
    for (const item of request.items) {
      const restock = restockSet ? restockSet.has(item.id) : true;
      if (item.restock !== restock) await tx.returnItem.update({ where: { id: item.id }, data: { restock } });
      await tx.orderItem.update({ where: { id: item.orderItemId }, data: { returnedQuantity: { increment: item.quantity } } });
      if (item.orderItem.productId) {
        await tx.$executeRaw`UPDATE "Product" SET "soldCount" = GREATEST("soldCount" - ${item.quantity}, 0) WHERE "id" = ${item.orderItem.productId}`;
      }
    }
    const restockLines = request.items
      .filter((item) => (restockSet ? restockSet.has(item.id) : true) && item.orderItem.variantId)
      .map((item) => ({ variantId: item.orderItem.variantId!, quantity: item.quantity, sku: item.orderItem.sku, productName: item.orderItem.productName }));
    await restoreStock(tx, restockLines, {
      type: "RETURN_RESTOCK",
      orderId: request.orderId,
      returnRequestId: request.id,
      actorId: actor.id,
      reason: `Return ${request.returnNumber} received`,
    });

    const items = await tx.orderItem.findMany({ where: { orderId: request.orderId }, select: { quantity: true, returnedQuantity: true } });
    if (items.every((i) => i.returnedQuantity >= i.quantity) && request.order.status === "DELIVERED") {
      await tx.order.update({ where: { id: request.orderId }, data: { status: "RETURNED" } });
      await tx.orderStatusHistory.create({
        data: { orderId: request.orderId, fromStatus: "DELIVERED", toStatus: "RETURNED", actorType: "STAFF", actorId: actor.id, note: `All items returned (${request.returnNumber})` },
      });
    }
    await writeAudit(tx, actor, { action: "return.receive", entityType: "ReturnRequest", entityId: id, metadata: { restocked: restockLines.length } });
    return { changed: true };
  });
}

export async function closeReturn(db: Db, actor: Actor, id: string) {
  assertPermission(actor, "order:update");
  const request = await db.returnRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError("Return request not found.");
  if (request.status !== "RECEIVED") throw new ConflictError("Only received returns can be closed.");
  await db.returnRequest.update({ where: { id }, data: { status: "CLOSED", resolvedAt: new Date() } });
  await writeAudit(db, actor, { action: "return.close", entityType: "ReturnRequest", entityId: id });
}

// ─────────────────────────────────────────────────────────────────────────────
// Refunds
// ─────────────────────────────────────────────────────────────────────────────

export type RefundInput = {
  orderId: string;
  amount: number; // poisha
  method: RefundMethod;
  reference: string | null;
  reason: string;
  returnRequestId: string | null;
  idempotencyKey: string;
};

/** Record a refund. Idempotent per idempotencyKey; never refunds more than was paid. */
export async function recordRefund(db: PrismaClient, actor: Actor, input: RefundInput) {
  assertPermission(actor, "order:refund");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new ValidationError("Enter a refund amount greater than zero.", { amount: ["Invalid amount."] });
  try {
    return await withTransaction(db, async (tx) => {
      const existing = await tx.refund.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return { refund: existing, duplicate: true };

      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { payments: { where: { status: "SUCCEEDED" }, orderBy: { createdAt: "desc" }, take: 1 } } });
      if (!order) throw new NotFoundError("Order not found.");
      const paid = toMinor(order.paidAmount);
      const refunded = toMinor(order.refundedAmount);
      const refundable = paid - refunded;
      if (paid <= 0) throw new ConflictError("No payment has been recorded for this order.");
      if (input.amount > refundable) {
        throw new ValidationError(`You can refund at most ${fromMinor(refundable)} BDT.`, { amount: ["Exceeds the refundable amount."] });
      }
      if (input.returnRequestId) {
        const ret = await tx.returnRequest.findFirst({ where: { id: input.returnRequestId, orderId: order.id }, select: { id: true } });
        if (!ret) throw new ValidationError("The return request does not belong to this order.");
      }
      const refund = await tx.refund.create({
        data: {
          orderId: order.id,
          paymentId: order.payments[0]?.id ?? null,
          returnRequestId: input.returnRequestId,
          amount: fromMinor(input.amount),
          method: input.method,
          status: "COMPLETED",
          reference: input.reference,
          reason: input.reason,
          createdById: actor.id,
          idempotencyKey: input.idempotencyKey,
          completedAt: new Date(),
        },
      });
      const newRefunded = refunded + input.amount;
      const paymentStatus: PaymentStatus = newRefunded >= paid ? "REFUNDED" : "PARTIALLY_REFUNDED";
      await tx.order.update({ where: { id: order.id }, data: { refundedAmount: fromMinor(newRefunded), paymentStatus } });
      await writeAudit(tx, actor, {
        action: "order.refund",
        entityType: "Order",
        entityId: order.id,
        metadata: { amount: fromMinor(input.amount), method: input.method, reference: input.reference },
      });
      return { refund, duplicate: false };
    });
  } catch (error) {
    if (isUniqueViolation(error, "idempotencyKey")) {
      const refund = await db.refund.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (refund) return { refund, duplicate: true };
    }
    throw error;
  }
}
