"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { ValidationError } from "@/lib/errors";
import { isSettingsGroup, type SettingsGroup } from "@/lib/settings-schema";
import { idSchema, optionalTextSchema } from "@/lib/validation/common";
import { formToObject, runAction } from "@/server/action";
import { requireActionPermission } from "@/server/auth/session";
import { invalidateSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { setContactMessageStatus } from "@/server/services/contact";
import { findUserByEmail, setUserActive, setUserRole, updateCustomerNote } from "@/server/services/customers";
import {
  deleteBanner,
  deleteCoupon,
  deleteDeliveryZone,
  deleteDiscount,
  moveBanner,
  saveBanner,
  saveCoupon,
  saveDeliveryZone,
  saveDiscount,
  setBannerActive,
} from "@/server/services/promotions";
import { updateSettingsGroup } from "@/server/services/settings";

const idOf = (formData: FormData) => {
  const value = formData.get("id");
  return typeof value === "string" && value ? value : null;
};

// ── Customers & staff ───────────────────────────────────────────────────────

export async function setUserActiveAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("customer:manage");
    const input = z.object({ id: idSchema, active: z.enum(["true", "false"]) }).parse(formToObject(formData));
    await setUserActive(prisma, actor, input.id, input.active === "true");
    refresh();
    return { ok: true, message: input.active === "true" ? "Account activated." : "Account deactivated and signed out." };
  });
}

export async function customerNoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("customer:manage");
    const input = z.object({ id: idSchema, note: optionalTextSchema(2000) }).parse(formToObject(formData));
    await updateCustomerNote(prisma, actor, input.id, input.note);
    refresh();
    return { ok: true, message: "Note saved." };
  });
}

const roleSchema = z.enum(["CUSTOMER", "ADMIN", "STORE_MANAGER", "INVENTORY_MANAGER"]);

export async function setUserRoleAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("staff:manage");
    const input = z.object({ id: idSchema, role: roleSchema }).parse(formToObject(formData));
    await setUserRole(prisma, actor, input.id, input.role);
    refresh();
    return { ok: true, message: "Role updated. The user must sign in again." };
  });
}

export async function grantStaffRoleAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("staff:manage");
    const input = z.object({ email: z.string().trim().email("Enter a valid email."), role: roleSchema.exclude(["CUSTOMER"]) }).parse(formToObject(formData));
    const user = await findUserByEmail(prisma, input.email);
    if (!user) throw new ValidationError("No account exists with that email. Ask the person to register first.", { email: ["Account not found."] });
    await setUserRole(prisma, actor, user.id, input.role);
    refresh();
    return { ok: true, message: `${user.name} is now a staff member.` };
  });
}

export async function messageStatusAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("messages:read");
    const input = z.object({ id: idSchema, status: z.enum(["NEW", "READ", "ARCHIVED"]) }).parse(formToObject(formData));
    await setContactMessageStatus(prisma, actor, input.id, input.status);
    refresh();
    return { ok: true, message: "Updated." };
  });
}

// ── Promotions ──────────────────────────────────────────────────────────────

export async function saveDiscountAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireActionPermission("promotion:write");
    await saveDiscount(prisma, actor, idOf(formData), formToObject(formData));
    return { ok: true, message: "Promotion saved." };
  });
  if (result.ok) redirect("/admin/discounts?saved=1");
  return result;
}

export async function deleteDiscountAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("promotion:write");
    await deleteDiscount(prisma, actor, idSchema.parse(formData.get("id")));
    refresh();
    return { ok: true, message: "Promotion deleted." };
  });
}

export async function saveCouponAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireActionPermission("promotion:write");
    await saveCoupon(prisma, actor, idOf(formData), formToObject(formData));
    return { ok: true, message: "Coupon saved." };
  });
  if (result.ok) redirect("/admin/coupons?saved=1");
  return result;
}

export async function deleteCouponAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("promotion:write");
    await deleteCoupon(prisma, actor, idSchema.parse(formData.get("id")));
    refresh();
    return { ok: true, message: "Coupon deleted." };
  });
}

export async function saveBannerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireActionPermission("promotion:write");
    await saveBanner(prisma, actor, idOf(formData), formToObject(formData));
    return { ok: true, message: "Banner saved." };
  });
  if (result.ok) redirect("/admin/banners?saved=1");
  return result;
}

export async function bannerCommandAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("promotion:write");
    const input = z.object({ id: idSchema, command: z.enum(["activate", "deactivate", "up", "down", "delete"]) }).parse(formToObject(formData));
    if (input.command === "activate" || input.command === "deactivate") await setBannerActive(prisma, actor, input.id, input.command === "activate");
    else if (input.command === "delete") await deleteBanner(prisma, actor, input.id);
    else await moveBanner(prisma, actor, input.id, input.command);
    refresh();
    return { ok: true };
  });
}

export async function saveDeliveryZoneAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("delivery:write");
    await saveDeliveryZone(prisma, actor, idOf(formData), formToObject(formData));
    refresh();
    return { ok: true, message: "Delivery zone saved." };
  });
}

export async function deleteDeliveryZoneAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("delivery:write");
    await deleteDeliveryZone(prisma, actor, idSchema.parse(formData.get("id")));
    refresh();
    return { ok: true, message: "Delivery zone deleted." };
  });
}

// ── Settings ────────────────────────────────────────────────────────────────

/** Settings forms post a JSON payload for one group; the service validates it with zod. */
export async function saveSettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("settings:write");
    const group = String(formData.get("group") ?? "");
    if (!isSettingsGroup(group)) throw new ValidationError("Unknown settings section.");
    const raw = formData.get("payload");
    if (typeof raw !== "string" || raw.length > 200_000) throw new ValidationError("Invalid submission.");
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new ValidationError("Invalid submission.");
    }
    await updateSettingsGroup(prisma, actor, group as SettingsGroup, payload);
    invalidateSettings();
    return { ok: true, message: "Settings saved." };
  });
}
