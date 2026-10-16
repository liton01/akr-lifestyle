import type { Prisma, Role } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { STAFF_ROLES, type Actor } from "@/lib/permissions";
import { addressSchema } from "@/lib/validation/checkout";
import { bdPhoneSchema, optionalTextSchema } from "@/lib/validation/common";
import { writeAudit } from "@/server/audit";
import type { Db } from "@/server/db";
import { assertPermission } from "@/server/services/authz";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Admin: customers and staff
// ─────────────────────────────────────────────────────────────────────────────

export async function listCustomers(db: Db, options: { q?: string; status?: "active" | "inactive"; page: number; pageSize: number }) {
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(options.status === "active" ? { isActive: true } : options.status === "inactive" ? { isActive: false } : {}),
    ...(options.q
      ? {
          OR: [
            { name: { contains: options.q, mode: "insensitive" } },
            { email: { contains: options.q, mode: "insensitive" } },
            { profile: { phone: { contains: options.q.replace(/\D/g, "") || options.q } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        profile: { select: { phone: true } },
        _count: { select: { orders: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  return { rows, total };
}

export async function getCustomerDetail(db: Db, id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      isActive: true,
      deactivatedAt: true,
      createdAt: true,
      lastLoginAt: true,
      profile: true,
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, orderNumber: true, status: true, paymentStatus: true, total: true, createdAt: true },
      },
    },
  });
  if (!user) return null;
  const spent = await db.order.aggregate({ _sum: { total: true }, _count: true, where: { userId: id, status: { not: "CANCELLED" } } });
  return { ...user, lifetimeValue: spent._sum.total, orderCount: spent._count };
}

export async function setUserActive(db: Db, actor: Actor, userId: string, isActive: boolean) {
  assertPermission(actor, "customer:manage");
  if (userId === actor.id) throw new ConflictError("You cannot deactivate your own account.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
  if (!user) throw new NotFoundError("User not found.");
  if (!isActive && user.role === "ADMIN") await assertAnotherActiveAdmin(db, userId);
  await db.user.update({ where: { id: userId }, data: { isActive, deactivatedAt: isActive ? null : new Date() } });
  if (!isActive) await db.session.deleteMany({ where: { userId } });
  await writeAudit(db, actor, { action: isActive ? "user.activate" : "user.deactivate", entityType: "User", entityId: userId });
}

export async function updateCustomerNote(db: Db, actor: Actor, userId: string, note: string | null) {
  assertPermission(actor, "customer:manage");
  await db.customerProfile.upsert({ where: { userId }, create: { userId, adminNote: note }, update: { adminNote: note } });
  await writeAudit(db, actor, { action: "customer.note", entityType: "User", entityId: userId });
}

async function assertAnotherActiveAdmin(db: Db, excludingUserId: string) {
  const admins = await db.user.count({ where: { role: "ADMIN", isActive: true, id: { not: excludingUserId } } });
  if (admins === 0) throw new ConflictError("At least one active administrator is required.");
}

export async function listStaff(db: Db) {
  return db.user.findMany({
    where: { role: { in: [...STAFF_ROLES] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
}

/** Change a user's role. Roles can only be changed here, by administrators. */
export async function setUserRole(db: Db, actor: Actor, userId: string, role: Role) {
  assertPermission(actor, "staff:manage");
  if (userId === actor.id) throw new ConflictError("You cannot change your own role.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, email: true } });
  if (!user) throw new NotFoundError("User not found.");
  if (user.role === "ADMIN" && role !== "ADMIN") await assertAnotherActiveAdmin(db, userId);
  await db.user.update({ where: { id: userId }, data: { role } });
  await db.session.deleteMany({ where: { userId } });
  await writeAudit(db, actor, { action: "user.role", entityType: "User", entityId: userId, metadata: { from: user.role, to: role } });
}

export async function findUserByEmail(db: Db, email: string) {
  return db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, name: true, email: true, role: true } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer self-service
// ─────────────────────────────────────────────────────────────────────────────

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  phone: z
    .union([z.literal(""), bdPhoneSchema])
    .optional()
    .transform((v) => (v ? v : null)),
  gender: optionalTextSchema(20),
  marketingOptIn: z
    .union([z.boolean(), z.string(), z.undefined(), z.null()])
    .transform((v) => v === true || v === "on" || v === "true")
    .default(false),
});

/** Only name and profile fields are writable — never role, email or status (mass-assignment safe). */
export async function updateOwnProfile(db: Db, userId: string, raw: unknown) {
  const input = profileSchema.parse(raw);
  await db.user.update({ where: { id: userId }, data: { name: input.name } });
  await db.customerProfile.upsert({
    where: { userId },
    create: { userId, phone: input.phone, gender: input.gender, marketingOptIn: input.marketingOptIn },
    update: { phone: input.phone, gender: input.gender, marketingOptIn: input.marketingOptIn },
  });
}

export async function listOwnAddresses(db: Db, userId: string) {
  return db.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
}

export async function saveOwnAddress(db: Db, userId: string, id: string | null, raw: unknown) {
  const input = addressSchema.parse(raw);
  if (id) {
    const owned = await db.address.findFirst({ where: { id, userId }, select: { id: true } });
    if (!owned) throw new NotFoundError("Address not found.");
  } else {
    const count = await db.address.count({ where: { userId } });
    if (count >= 10) throw new ValidationError("You can save up to 10 addresses.");
  }
  const count = await db.address.count({ where: { userId } });
  const makeDefault = input.isDefault || count === 0;
  const data = {
    label: input.label,
    fullName: input.fullName,
    phone: input.phone,
    district: input.district,
    area: input.area,
    addressLine: input.addressLine,
    postalCode: input.postalCode,
    isDefault: makeDefault,
  };
  const saved = id ? await db.address.update({ where: { id }, data }) : await db.address.create({ data: { ...data, userId } });
  if (makeDefault) await db.address.updateMany({ where: { userId, id: { not: saved.id } }, data: { isDefault: false } });
  return saved;
}

export async function deleteOwnAddress(db: Db, userId: string, id: string) {
  const address = await db.address.findFirst({ where: { id, userId } });
  if (!address) throw new NotFoundError("Address not found.");
  await db.address.delete({ where: { id } });
  if (address.isDefault) {
    const next = await db.address.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
    if (next) await db.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }
}

export async function listOwnOrders(db: Db, userId: string, page: number, pageSize: number) {
  const where = { userId };
  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        total: true,
        createdAt: true,
        items: { select: { productName: true, imageUrl: true, quantity: true }, take: 3 },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return { rows, total };
}
