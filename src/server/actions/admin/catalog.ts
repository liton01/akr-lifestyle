"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { ValidationError } from "@/lib/errors";
import { formToObject, runAction } from "@/server/action";
import { requireActionPermission } from "@/server/auth/session";
import { invalidateBrands, invalidateCategories } from "@/server/cache";
import { prisma } from "@/server/db";
import { notifyLowStock } from "@/server/notifications";
import { deleteAttribute, deleteAttributeValue, saveAttribute, saveAttributeValue } from "@/server/services/attributes";
import { deleteBrand, reassignBrandProducts, saveBrand } from "@/server/services/brands";
import { deleteCategory, reassignCategoryProducts, saveCategory } from "@/server/services/categories";
import { adjustStock } from "@/server/services/inventory";
import { createProduct, deleteProduct, setProductStatus, updateProduct } from "@/server/services/products";

const idField = (formData: FormData, key = "id") => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

function parsePayload(formData: FormData): unknown {
  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.length > 500_000) throw new ValidationError("Invalid form submission.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("Invalid form submission.");
  }
}

// ── Products ────────────────────────────────────────────────────────────────

export async function saveProductAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  let createdId: string | null = null;
  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActionPermission("product:write");
    const id = idField(formData);
    const payload = parsePayload(formData);
    if (id) {
      const product = await updateProduct(prisma, actor, id, payload);
      refresh();
      return { ok: true, message: "Product saved.", data: { id: product.id } };
    }
    const product = await createProduct(prisma, actor, payload);
    createdId = product.id;
    return { ok: true, data: { id: product.id } };
  });
  if (createdId) redirect(`/admin/products/${createdId}?created=1`);
  return result;
}

const statusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export async function setProductStatusAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("product:write");
    const id = z.string().min(1).parse(formData.get("id"));
    const status = statusSchema.parse(formData.get("status"));
    await setProductStatus(prisma, actor, id, status);
    refresh();
    return { ok: true, message: status === "ARCHIVED" ? "Product archived." : status === "ACTIVE" ? "Product published." : "Product moved to draft." };
  });
}

export async function deleteProductAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let deleted = false;
  const result = await runAction(async () => {
    const actor = await requireActionPermission("product:delete");
    await deleteProduct(prisma, actor, z.string().min(1).parse(formData.get("id")));
    deleted = true;
    return { ok: true };
  });
  if (deleted) redirect("/admin/products?deleted=1");
  return result;
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function saveCategoryAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireActionPermission("catalog:write");
    await saveCategory(prisma, actor, idField(formData), formToObject(formData));
    invalidateCategories();
    return { ok: true, message: "Category saved." };
  });
  if (result.ok && !idField(formData)) redirect("/admin/categories?saved=1");
  return result;
}

export async function deleteCategoryAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireActionPermission("catalog:write");
    await deleteCategory(prisma, actor, z.string().min(1).parse(formData.get("id")));
    invalidateCategories();
    return { ok: true, message: "Category deleted." };
  });
  if (result.ok) redirect("/admin/categories?deleted=1");
  return result;
}

export async function reassignCategoryAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("catalog:write");
    const count = await reassignCategoryProducts(prisma, actor, z.string().min(1).parse(formData.get("id")), z.string().min(1, "Choose a category.").parse(formData.get("targetId")));
    invalidateCategories();
    refresh();
    return { ok: true, message: `${count} product(s) moved.` };
  });
}

// ── Brands ──────────────────────────────────────────────────────────────────

export async function saveBrandAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireActionPermission("catalog:write");
    await saveBrand(prisma, actor, idField(formData), formToObject(formData));
    invalidateBrands();
    return { ok: true, message: "Brand saved." };
  });
  if (result.ok && !idField(formData)) redirect("/admin/brands?saved=1");
  return result;
}

export async function deleteBrandAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireActionPermission("catalog:write");
    await deleteBrand(prisma, actor, z.string().min(1).parse(formData.get("id")));
    invalidateBrands();
    return { ok: true, message: "Brand deleted." };
  });
  if (result.ok) redirect("/admin/brands?deleted=1");
  return result;
}

export async function reassignBrandAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("catalog:write");
    const target = idField(formData, "targetId");
    const count = await reassignBrandProducts(prisma, actor, z.string().min(1).parse(formData.get("id")), target);
    invalidateBrands();
    refresh();
    return { ok: true, message: `${count} product(s) updated.` };
  });
}

// ── Attributes ──────────────────────────────────────────────────────────────

export async function saveAttributeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("catalog:write");
    await saveAttribute(prisma, actor, idField(formData), formToObject(formData));
    refresh();
    return { ok: true, message: "Attribute saved." };
  });
}

export async function deleteAttributeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("catalog:write");
    await deleteAttribute(prisma, actor, z.string().min(1).parse(formData.get("id")));
    refresh();
    return { ok: true, message: "Attribute deleted." };
  });
}

export async function saveAttributeValueAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("catalog:write");
    await saveAttributeValue(prisma, actor, idField(formData), formToObject(formData));
    refresh();
    return { ok: true, message: "Value saved." };
  });
}

export async function deleteAttributeValueAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("catalog:write");
    await deleteAttributeValue(prisma, actor, z.string().min(1).parse(formData.get("id")));
    refresh();
    return { ok: true, message: "Value deleted." };
  });
}

// ── Inventory ───────────────────────────────────────────────────────────────

export async function adjustStockAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActionPermission("inventory:adjust");
    const result = await adjustStock(prisma, actor, formToObject(formData));
    if (result.lowStock.length) {
      after(() => notifyLowStock(prisma, result.lowStock.map((l) => ({ sku: l.sku, name: l.name, quantity: l.quantity, threshold: l.threshold }))));
    }
    refresh();
    return { ok: true, message: `Stock updated: ${result.before} → ${result.after}.` };
  });
}
