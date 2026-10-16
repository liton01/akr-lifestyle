import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { slugify } from "@/lib/utils";
import { attributeInputSchema, attributeValueInputSchema } from "@/lib/validation/catalog";
import { writeAudit } from "@/server/audit";
import type { Db } from "@/server/db";
import { assertPermission } from "@/server/services/authz";

export async function saveAttribute(db: Db, actor: Actor, id: string | null, raw: unknown) {
  assertPermission(actor, "catalog:write");
  const input = attributeInputSchema.parse(raw);
  const data = { name: input.name, slug: slugify(input.name), displayType: input.displayType, sortOrder: input.sortOrder };
  try {
    const saved = id ? await db.attribute.update({ where: { id }, data }) : await db.attribute.create({ data });
    await writeAudit(db, actor, { action: id ? "attribute.update" : "attribute.create", entityType: "Attribute", entityId: saved.id, metadata: { name: saved.name } });
    return saved;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ValidationError("An attribute with this name already exists.", { name: ["Already exists."] });
    throw error;
  }
}

export async function deleteAttribute(db: Db, actor: Actor, id: string) {
  assertPermission(actor, "catalog:write");
  const used = await db.variantOption.count({ where: { attributeId: id } });
  if (used > 0) throw new ConflictError(`This attribute is used by ${used} variant(s) and cannot be deleted.`);
  const attribute = await db.attribute.findUnique({ where: { id } });
  if (!attribute) throw new NotFoundError("Attribute not found.");
  await db.attribute.delete({ where: { id } });
  await writeAudit(db, actor, { action: "attribute.delete", entityType: "Attribute", entityId: id, metadata: { name: attribute.name } });
}

export async function saveAttributeValue(db: Db, actor: Actor, id: string | null, raw: unknown) {
  assertPermission(actor, "catalog:write");
  const input = attributeValueInputSchema.parse(raw);
  const attribute = await db.attribute.findUnique({ where: { id: input.attributeId }, select: { id: true } });
  if (!attribute) throw new NotFoundError("Attribute not found.");
  const data = { attributeId: input.attributeId, value: input.value, colorHex: input.colorHex, sortOrder: input.sortOrder };
  try {
    const saved = id ? await db.attributeValue.update({ where: { id }, data }) : await db.attributeValue.create({ data });
    await writeAudit(db, actor, {
      action: id ? "attribute-value.update" : "attribute-value.create",
      entityType: "AttributeValue",
      entityId: saved.id,
      metadata: { value: saved.value },
    });
    return saved;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ValidationError("This value already exists for the attribute.", { value: ["Already exists."] });
    throw error;
  }
}

export async function deleteAttributeValue(db: Db, actor: Actor, id: string) {
  assertPermission(actor, "catalog:write");
  const used = await db.variantOption.count({ where: { attributeValueId: id } });
  if (used > 0) throw new ConflictError(`This value is used by ${used} variant(s) and cannot be deleted.`);
  await db.attributeValue.delete({ where: { id } });
  await writeAudit(db, actor, { action: "attribute-value.delete", entityType: "AttributeValue", entityId: id });
}
