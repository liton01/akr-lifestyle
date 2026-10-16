"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { ValidationError } from "@/lib/errors";
import { idSchema, moneySchema, optionalTextSchema } from "@/lib/validation/common";
import { formToObject, runAction } from "@/server/action";
import { requireActionPermission } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { notifyOrderStatus, notifyPaymentStatus } from "@/server/notifications";
import { expireUnpaidOrders, markCodPaid, updateAdminNote, updateOrderShipping, updateOrderStatus } from "@/server/services/orders";
import { closeReturn, createReturnRequest, receiveReturn, recordRefund, reviewReturn } from "@/server/services/returns";

const statusSchema = z.object({
  orderId: idSchema,
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]),
  note: optionalTextSchema(500),
  courierName: optionalTextSchema(80),
  trackingNumber: optionalTextSchema(80),
  notifyCustomer: z
    .union([z.string(), z.undefined()])
    .transform((v) => v === "on")
    .default(false),
});

export async function updateOrderStatusAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("order:update");
    const input = statusSchema.parse(formToObject(formData));
    const result = await updateOrderStatus(prisma, actor, input.orderId, {
      status: input.status,
      note: input.note,
      courierName: input.courierName ?? undefined,
      trackingNumber: input.trackingNumber ?? undefined,
    });
    if (result.changed && input.notifyCustomer) after(() => notifyOrderStatus(prisma, input.orderId, input.status, input.note));
    refresh();
    return { ok: true, message: result.changed ? "Order status updated." : "No change." };
  });
}

export async function updateShippingAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("order:update");
    const input = z
      .object({ orderId: idSchema, courierName: optionalTextSchema(80), trackingNumber: optionalTextSchema(80) })
      .parse(formToObject(formData));
    await updateOrderShipping(prisma, actor, input.orderId, { courierName: input.courierName, trackingNumber: input.trackingNumber });
    refresh();
    return { ok: true, message: "Shipping details saved." };
  });
}

export async function updateAdminNoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("order:update");
    const input = z.object({ orderId: idSchema, adminNote: optionalTextSchema(2000) }).parse(formToObject(formData));
    await updateAdminNote(prisma, actor, input.orderId, input.adminNote);
    refresh();
    return { ok: true, message: "Note saved." };
  });
}

export async function markCodPaidAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("order:update");
    const orderId = idSchema.parse(formData.get("orderId"));
    const result = await markCodPaid(prisma, actor, orderId);
    if (result.changed) after(() => notifyPaymentStatus(prisma, orderId, true));
    refresh();
    return { ok: true, message: result.changed ? "Cash payment recorded." : "Already marked as paid." };
  });
}

const refundSchema = z.object({
  orderId: idSchema,
  amount: moneySchema,
  method: z.enum(["CASH", "BKASH", "NAGAD", "ROCKET", "BANK_TRANSFER", "GATEWAY", "OTHER"]),
  reference: optionalTextSchema(120),
  reason: z.string().trim().min(3, "Give a reason for the refund.").max(500),
  returnRequestId: optionalTextSchema(64),
  idempotencyKey: z.string().uuid("Refresh the page and try again."),
});

export async function recordRefundAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("order:refund");
    const input = refundSchema.parse(formToObject(formData));
    const result = await recordRefund(prisma, actor, input);
    refresh();
    return { ok: true, message: result.duplicate ? "This refund was already recorded." : "Refund recorded." };
  });
}

export async function reviewReturnAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("order:update");
    const input = z
      .object({ id: idSchema, decision: z.enum(["APPROVE", "REJECT"]), note: optionalTextSchema(1000) })
      .parse(formToObject(formData));
    await reviewReturn(prisma, actor, input.id, input.decision, input.note);
    refresh();
    return { ok: true, message: input.decision === "APPROVE" ? "Return approved." : "Return rejected." };
  });
}

export async function receiveReturnAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("order:update");
    const id = idSchema.parse(formData.get("id"));
    const restock = formData.getAll("restock").filter((v): v is string => typeof v === "string");
    const result = await receiveReturn(prisma, actor, id, restock);
    refresh();
    return { ok: true, message: result.changed ? "Return received and stock updated." : "This return was already received." };
  });
}

export async function closeReturnAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("order:update");
    await closeReturn(prisma, actor, idSchema.parse(formData.get("id")));
    refresh();
    return { ok: true, message: "Return closed." };
  });
}

/** Staff can open a return on behalf of a customer (no return-window restriction). */
export async function staffCreateReturnAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("order:update");
    const orderId = idSchema.parse(formData.get("orderId"));
    const reason = String(formData.get("reason") ?? "");
    const items: { orderItemId: string; quantity: number }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("qty:") && typeof value === "string" && Number(value) > 0) items.push({ orderItemId: key.slice(4), quantity: Number(value) });
    }
    if (!items.length) throw new ValidationError("Choose at least one item.");
    const { commerce, general } = await getSettings();
    const request = await createReturnRequest(prisma, { type: "STAFF", actor }, { orderId, reason, items }, { returnWindowDays: commerce.returnWindowDays, timeZone: general.timeZone });
    refresh();
    return { ok: true, message: `Return ${request.returnNumber} created.` };
  });
}

export async function expireUnpaidOrdersAction(): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionPermission("order:update");
    const count = await expireUnpaidOrders(prisma);
    refresh();
    return { ok: true, message: `${count} unpaid order(s) cancelled.` };
  });
}
