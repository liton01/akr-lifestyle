import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { brandInputSchema } from "@/lib/validation/catalog";
import { diffRecords, writeAudit } from "@/server/audit";
import type { Db } from "@/server/db";
import { assertPermission } from "@/server/services/authz";
import { uniqueSlug } from "@/server/services/slug";

export async function saveBrand(db: Db, actor: Actor, id: string | null, raw: unknown) {
  assertPermission(actor, "catalog:write");
  const input = brandInputSchema.parse(raw);
  const slug =
    input.slug ||
    (await uniqueSlug(input.name, async (candidate) => {
      const existing = await db.brand.findUnique({ where: { slug: candidate }, select: { id: true } });
      return Boolean(existing && existing.id !== id);
    }));
  const data = {
    name: input.name,
    slug,
    description: input.description,
    logoUrl: input.logoUrl || null,
    website: input.website || null,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  };
  try {
    if (id) {
      const before = await db.brand.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Brand not found.");
      const updated = await db.brand.update({ where: { id }, data });
      await writeAudit(db, actor, { action: "brand.update", entityType: "Brand", entityId: id, metadata: diffRecords(before, updated) as never });
      return updated;
    }
    const created = await db.brand.create({ data });
    await writeAudit(db, actor, { action: "brand.create", entityType: "Brand", entityId: created.id, metadata: { name: created.name } });
    return created;
  } catch (error) {
    if (isUniqueViolation(error, "name")) throw new ValidationError("A brand with this name already exists.", { name: ["Already exists."] });
    if (isUniqueViolation(error, "slug")) throw new ValidationError("That slug is already used.", { slug: ["Choose a different slug."] });
    throw error;
  }
}

export async function deleteBrand(db: Db, actor: Actor, id: string) {
  assertPermission(actor, "catalog:write");
  const brand = await db.brand.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!brand) throw new NotFoundError("Brand not found.");
  if (brand._count.products > 0) {
    throw new ConflictError(`${brand._count.products} product(s) still use this brand. Reassign them or deactivate the brand instead.`);
  }
  await db.brand.delete({ where: { id } });
  await writeAudit(db, actor, { action: "brand.delete", entityType: "Brand", entityId: id, metadata: { name: brand.name } });
}

/** Move products to another brand, or clear their brand when toId is null. */
export async function reassignBrandProducts(db: Db, actor: Actor, fromId: string, toId: string | null) {
  assertPermission(actor, "catalog:write");
  if (fromId === toId) throw new ValidationError("Choose a different target brand.");
  if (toId) {
    const target = await db.brand.findUnique({ where: { id: toId }, select: { id: true } });
    if (!target) throw new NotFoundError("Target brand not found.");
  }
  const result = await db.product.updateMany({ where: { brandId: fromId }, data: { brandId: toId } });
  await writeAudit(db, actor, { action: "brand.reassign-products", entityType: "Brand", entityId: fromId, metadata: { to: toId, count: result.count } });
  return result.count;
}
