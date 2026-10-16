"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { formToObject, runAction } from "@/server/action";
import { requireActionUser } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { enforceRateLimit, LIMITS } from "@/server/rate-limit";
import { deleteOwnAddress, saveOwnAddress, updateOwnProfile } from "@/server/services/customers";
import { createReturnRequest } from "@/server/services/returns";
import { sendEmail } from "@/server/notifications";
import { env, siteUrl } from "@/server/env";

export async function updateProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await updateOwnProfile(prisma, user.id, formToObject(formData));
    refresh();
    return { ok: true, message: "Your profile has been updated." };
  });
}

export async function saveAddressAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const raw = formToObject(formData);
    const id = typeof raw.id === "string" && raw.id ? raw.id : null;
    await saveOwnAddress(prisma, user.id, id, raw);
    refresh();
    return { ok: true, message: id ? "Address updated." : "Address added." };
  });
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const user = await requireActionUser();
  const id = z.string().min(1).parse(formData.get("id"));
  await deleteOwnAddress(prisma, user.id, id);
  refresh();
}

export async function setDefaultAddressAction(formData: FormData): Promise<void> {
  const user = await requireActionUser();
  const id = z.string().min(1).parse(formData.get("id"));
  const owned = await prisma.address.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!owned) return;
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    prisma.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
  refresh();
}

export async function requestReturnAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await enforceRateLimit(prisma, `return:${user.id}`, LIMITS.returnRequest[0], LIMITS.returnRequest[1]);
    const orderId = String(formData.get("orderId") ?? "");
    const reason = String(formData.get("reason") ?? "");
    const items: { orderItemId: string; quantity: number }[] = [];
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("qty:") || typeof value !== "string") continue;
      const quantity = Number.parseInt(value, 10);
      if (quantity > 0) items.push({ orderItemId: key.slice(4), quantity });
    }
    const { commerce, general } = await getSettings();
    const request = await createReturnRequest(
      prisma,
      { type: "CUSTOMER", userId: user.id },
      { orderId, reason, items },
      { returnWindowDays: commerce.returnWindowDays, timeZone: general.timeZone },
    );
    const staffEmail = env().STORE_NOTIFICATION_EMAIL;
    if (staffEmail) {
      after(() =>
        sendEmail(prisma, "RETURN_REQUESTED", staffEmail, {
          subject: `Return requested: ${request.returnNumber}`,
          text: `A customer requested a return (${request.returnNumber}).\n\n${siteUrl("/admin/returns")}`,
          html: `<p>A customer requested a return (${request.returnNumber}).</p><p><a href="${siteUrl("/admin/returns")}">Review returns</a></p>`,
        }, orderId),
      );
    }
    refresh();
    return { ok: true, message: `Return request ${request.returnNumber} submitted. We will contact you shortly.` };
  });
}
