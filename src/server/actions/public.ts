"use server";

import { after } from "next/server";
import type { ActionResult } from "@/lib/action-result";
import { toMinor } from "@/lib/money";
import { trackOrderSchema } from "@/lib/validation/checkout";
import { formToObject, runAction } from "@/server/action";
import { prisma } from "@/server/db";
import { notifyContactMessage } from "@/server/notifications";
import { enforceRateLimit, LIMITS } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { contactSchema, createContactMessage } from "@/server/services/contact";
import { trackOrder } from "@/server/services/orders";

export type TrackResult = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
  total: number;
  itemCount: number;
  district: string;
  courierName: string | null;
  trackingNumber: string | null;
  history: { status: string; at: string }[];
};

export async function trackOrderAction(_prev: ActionResult<TrackResult> | null, formData: FormData): Promise<ActionResult<TrackResult>> {
  return runAction<TrackResult>(async () => {
    const input = trackOrderSchema.parse(formToObject(formData));
    await enforceRateLimit(prisma, `track:${await clientIp()}`, LIMITS.trackOrder[0], LIMITS.trackOrder[1]);
    const order = await trackOrder(prisma, input.orderNumber, input.phone);
    if (!order) return { ok: false, message: "We could not find an order with that number and phone number." };
    return {
      ok: true,
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt.toISOString(),
        total: toMinor(order.total),
        itemCount: order._count.items,
        district: order.shippingDistrict,
        courierName: order.courierName,
        trackingNumber: order.trackingNumber,
        history: order.statusHistory.map((h) => ({ status: h.toStatus, at: h.createdAt.toISOString() })),
      },
    };
  });
}

export async function contactAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const raw = formToObject(formData);
    contactSchema.parse(raw);
    await enforceRateLimit(prisma, `contact:${await clientIp()}`, LIMITS.contact[0], LIMITS.contact[1], "You have sent several messages recently. Please try again later.");
    const message = await createContactMessage(prisma, raw);
    after(() => notifyContactMessage(prisma, message));
    return { ok: true, message: "Thank you! Your message has been sent. We will reply within one business day." };
  });
}
