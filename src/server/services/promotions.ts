import type { Prisma } from "@prisma/client";
import { canonicalDistrict } from "@/lib/constants";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "@/lib/errors";
import { fromMinor } from "@/lib/money";
import type { Actor } from "@/lib/permissions";
import { bannerInputSchema, couponInputSchema, deliveryZoneInputSchema, discountInputSchema } from "@/lib/validation/promotions";
import { writeAudit } from "@/server/audit";
import type { Db } from "@/server/db";
import { assertPermission } from "@/server/services/authz";

const money = (minor: number | null) => (minor === null ? null : fromMinor(minor));
const connectIds = (ids: string[]) => ids.map((id) => ({ id }));

// ─────────────────────────────────────────────────────────────────────────────
// Automatic discounts
// ─────────────────────────────────────────────────────────────────────────────

export async function saveDiscount(db: Db, actor: Actor, id: string | null, raw: unknown) {
  assertPermission(actor, "promotion:write");
  const input = discountInputSchema.parse(raw);
  const productIds = input.scope === "PRODUCT" ? input.productIds : [];
  const categoryIds = input.scope === "CATEGORY" ? input.categoryIds : [];
  const brandIds = input.scope === "BRAND" ? input.brandIds : [];
  const data = {
    name: input.name,
    description: input.description,
    type: input.type,
    value: fromMinor(input.value),
    scope: input.scope,
    maxDiscountAmount: money(input.maxDiscountAmount),
    badgeLabel: input.badgeLabel,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    isActive: input.isActive,
  };
  const saved = id
    ? await db.discount.update({
        where: { id },
        data: { ...data, products: { set: connectIds(productIds) }, categories: { set: connectIds(categoryIds) }, brands: { set: connectIds(brandIds) } },
      })
    : await db.discount.create({
        data: { ...data, products: { connect: connectIds(productIds) }, categories: { connect: connectIds(categoryIds) }, brands: { connect: connectIds(brandIds) } },
      });
  await writeAudit(db, actor, {
    action: id ? "discount.update" : "discount.create",
    entityType: "Discount",
    entityId: saved.id,
    metadata: { name: saved.name, type: saved.type, value: saved.value.toFixed(2), scope: saved.scope, isActive: saved.isActive },
  });
  return saved;
}

export async function deleteDiscount(db: Db, actor: Actor, id: string) {
  assertPermission(actor, "promotion:write");
  const discount = await db.discount.findUnique({ where: { id } });
  if (!discount) throw new NotFoundError("Discount not found.");
  // Order items keep their own price snapshots, so removing a promotion never changes past orders.
  await db.discount.delete({ where: { id } });
  await writeAudit(db, actor, { action: "discount.delete", entityType: "Discount", entityId: id, metadata: { name: discount.name } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Coupons
// ─────────────────────────────────────────────────────────────────────────────

export async function saveCoupon(db: Db, actor: Actor, id: string | null, raw: unknown) {
  assertPermission(actor, "promotion:write");
  const input = couponInputSchema.parse(raw);
  const productIds = input.scope === "PRODUCT" ? input.productIds : [];
  const categoryIds = input.scope === "CATEGORY" ? input.categoryIds : [];
  const data = {
    code: input.code,
    description: input.description,
    type: input.type,
    value: fromMinor(input.value),
    scope: input.scope,
    minOrderAmount: money(input.minOrderAmount),
    maxDiscountAmount: money(input.maxDiscountAmount),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    isActive: input.isActive,
    usageLimit: input.usageLimit,
    perCustomerLimit: input.perCustomerLimit,
    newCustomersOnly: input.newCustomersOnly,
    appliesToSaleItems: input.appliesToSaleItems,
  };
  try {
    if (id) {
      const existing = await db.coupon.findUnique({ where: { id }, select: { usedCount: true } });
      if (!existing) throw new NotFoundError("Coupon not found.");
      if (input.usageLimit !== null && input.usageLimit < existing.usedCount) {
        throw new ValidationError(`The coupon has already been used ${existing.usedCount} times.`, { usageLimit: ["Limit is below current usage."] });
      }
    }
    const saved = id
      ? await db.coupon.update({ where: { id }, data: { ...data, products: { set: connectIds(productIds) }, categories: { set: connectIds(categoryIds) } } })
      : await db.coupon.create({ data: { ...data, products: { connect: connectIds(productIds) }, categories: { connect: connectIds(categoryIds) } } });
    await writeAudit(db, actor, {
      action: id ? "coupon.update" : "coupon.create",
      entityType: "Coupon",
      entityId: saved.id,
      metadata: { code: saved.code, type: saved.type, value: saved.value.toFixed(2), isActive: saved.isActive },
    });
    return saved;
  } catch (error) {
    if (isUniqueViolation(error, "code")) throw new ValidationError("This coupon code already exists.", { code: ["Already exists."] });
    throw error;
  }
}

export async function deleteCoupon(db: Db, actor: Actor, id: string) {
  assertPermission(actor, "promotion:write");
  const coupon = await db.coupon.findUnique({ where: { id }, include: { _count: { select: { usages: true } } } });
  if (!coupon) throw new NotFoundError("Coupon not found.");
  if (coupon._count.usages > 0) throw new ConflictError("This coupon has been used on orders. Deactivate it instead of deleting it.");
  await db.coupon.delete({ where: { id } });
  await writeAudit(db, actor, { action: "coupon.delete", entityType: "Coupon", entityId: id, metadata: { code: coupon.code } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Banners
// ─────────────────────────────────────────────────────────────────────────────

export async function saveBanner(db: Db, actor: Actor, id: string | null, raw: unknown) {
  assertPermission(actor, "promotion:write");
  const input = bannerInputSchema.parse(raw);
  const data = {
    eyebrow: input.eyebrow,
    title: input.title,
    subtitle: input.subtitle,
    imageUrl: input.imageUrl,
    mobileImageUrl: input.mobileImageUrl || null,
    linkUrl: input.linkUrl || null,
    ctaLabel: input.ctaLabel,
    secondaryCtaLabel: input.secondaryCtaLabel,
    secondaryLinkUrl: input.secondaryLinkUrl || null,
    textTone: input.textTone,
    placement: input.placement,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  };
  const saved = id ? await db.banner.update({ where: { id }, data }) : await db.banner.create({ data });
  await writeAudit(db, actor, { action: id ? "banner.update" : "banner.create", entityType: "Banner", entityId: saved.id, metadata: { title: saved.title } });
  return saved;
}

export async function setBannerActive(db: Db, actor: Actor, id: string, isActive: boolean) {
  assertPermission(actor, "promotion:write");
  await db.banner.update({ where: { id }, data: { isActive } });
  await writeAudit(db, actor, { action: isActive ? "banner.activate" : "banner.deactivate", entityType: "Banner", entityId: id });
}

/** Move a banner one position up or down within its placement. */
export async function moveBanner(db: Db, actor: Actor, id: string, direction: "up" | "down") {
  assertPermission(actor, "promotion:write");
  const banner = await db.banner.findUnique({ where: { id } });
  if (!banner) throw new NotFoundError("Banner not found.");
  const siblings = await db.banner.findMany({ where: { placement: banner.placement }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const index = siblings.findIndex((b) => b.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= siblings.length) return;
  const reordered = [...siblings];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];
  await Promise.all(reordered.map((b, i) => db.banner.update({ where: { id: b.id }, data: { sortOrder: i * 10 } })));
  await writeAudit(db, actor, { action: "banner.reorder", entityType: "Banner", entityId: id, metadata: { direction } });
}

export async function deleteBanner(db: Db, actor: Actor, id: string) {
  assertPermission(actor, "promotion:write");
  await db.banner.delete({ where: { id } });
  await writeAudit(db, actor, { action: "banner.delete", entityType: "Banner", entityId: id });
}

export async function getActiveBanners(db: Db, placement: Prisma.BannerWhereInput["placement"], now = new Date()) {
  return db.banner.findMany({
    where: {
      placement,
      isActive: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Delivery zones
// ─────────────────────────────────────────────────────────────────────────────

export async function saveDeliveryZone(db: Db, actor: Actor, id: string | null, raw: unknown) {
  assertPermission(actor, "delivery:write");
  const input = deliveryZoneInputSchema.parse(raw);
  const districts: string[] = [];
  for (const name of input.districts) {
    const canonical = canonicalDistrict(name);
    if (!canonical) throw new ValidationError(`Unknown district: ${name}`, { districts: ["Choose districts from the list."] });
    if (!districts.includes(canonical)) districts.push(canonical);
  }
  if (!input.isDefault && districts.length === 0) {
    throw new ValidationError("Choose at least one district, or make this the default zone.", { districts: ["Required."] });
  }
  const others = await db.deliveryZone.findMany({ where: { ...(id ? { id: { not: id } } : {}), isActive: true }, select: { name: true, districts: true } });
  for (const other of others) {
    const overlap = other.districts.filter((d) => districts.includes(d));
    if (overlap.length) throw new ValidationError(`${overlap.join(", ")} already belong to "${other.name}".`, { districts: ["Districts overlap another zone."] });
  }
  const data = {
    name: input.name,
    districts,
    fee: fromMinor(input.fee),
    freeDeliveryThreshold: money(input.freeDeliveryThreshold),
    estimatedDays: input.estimatedDays,
    isDefault: input.isDefault,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };
  try {
    const saved = id ? await db.deliveryZone.update({ where: { id }, data }) : await db.deliveryZone.create({ data });
    if (saved.isDefault) {
      await db.deliveryZone.updateMany({ where: { id: { not: saved.id }, isDefault: true }, data: { isDefault: false } });
    }
    await writeAudit(db, actor, {
      action: id ? "delivery-zone.update" : "delivery-zone.create",
      entityType: "DeliveryZone",
      entityId: saved.id,
      metadata: { name: saved.name, fee: saved.fee.toFixed(2) },
    });
    return saved;
  } catch (error) {
    if (isUniqueViolation(error, "name")) throw new ValidationError("A zone with this name already exists.", { name: ["Already exists."] });
    throw error;
  }
}

export async function deleteDeliveryZone(db: Db, actor: Actor, id: string) {
  assertPermission(actor, "delivery:write");
  await db.deliveryZone.delete({ where: { id } });
  await writeAudit(db, actor, { action: "delivery-zone.delete", entityType: "DeliveryZone", entityId: id });
}
