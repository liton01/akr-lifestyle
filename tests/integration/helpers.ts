import { randomUUID } from "node:crypto";
import type { PrismaClient, Role } from "@prisma/client";
import type { Actor } from "@/lib/permissions";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
import { sha256Hex } from "@/server/crypto";
import type { CartOwner } from "@/server/services/cart";
import { testDatabaseUrl } from "./test-db";

/** Empty every application table in the (guarded) test database. */
export async function resetDatabase(db: PrismaClient) {
  testDatabaseUrl();
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function createActor(db: PrismaClient, role: Role, email = `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@test.local`): Promise<Actor> {
  const user = await db.user.create({ data: { id: randomUUID(), email, name: `${role} user`, role, emailVerified: true } });
  return { id: user.id, role: user.role, email: user.email, name: user.name };
}

export async function createCustomer(db: PrismaClient) {
  const user = await db.user.create({ data: { id: randomUUID(), email: `cust-${randomUUID().slice(0, 8)}@test.local`, name: "Test Customer", role: "CUSTOMER" } });
  return user;
}

export async function seedBasics(db: PrismaClient) {
  const category = await db.category.create({ data: { name: "Watches", slug: `watches-${randomUUID().slice(0, 6)}` } });
  const child = await db.category.create({ data: { name: "Smartwatches", slug: `smart-${randomUUID().slice(0, 6)}`, parentId: category.id } });
  const brand = await db.brand.create({ data: { name: `Brand ${randomUUID().slice(0, 6)}`, slug: `brand-${randomUUID().slice(0, 6)}` } });
  await db.deliveryZone.create({ data: { name: "Inside Dhaka", districts: ["Dhaka"], fee: "70.00", freeDeliveryThreshold: "5000.00", sortOrder: 1 } });
  await db.deliveryZone.create({ data: { name: "Outside Dhaka", districts: [], fee: "130.00", isDefault: true, sortOrder: 2 } });
  return { category, child, brand };
}

/** Create an active simple product (one default variant) with stock. Prices in BDT. */
export async function createProduct(
  db: PrismaClient,
  opts: { categoryId: string; brandId?: string | null; price: number; stock: number; salePrice?: number; compareAtPrice?: number; sku?: string; status?: "ACTIVE" | "DRAFT" },
) {
  const sku = opts.sku ?? `SKU-${randomUUID().slice(0, 8).toUpperCase()}`;
  const product = await db.product.create({
    data: {
      name: `Product ${sku}`,
      slug: sku.toLowerCase(),
      sku,
      description: "Test product",
      categoryId: opts.categoryId,
      brandId: opts.brandId ?? null,
      price: opts.price.toFixed(2),
      salePrice: opts.salePrice?.toFixed(2) ?? null,
      compareAtPrice: opts.compareAtPrice?.toFixed(2) ?? null,
      costPrice: (opts.price * 0.6).toFixed(2),
      status: opts.status ?? "ACTIVE",
      variants: { create: { sku, name: "Default", isDefault: true, inventory: { create: { quantity: opts.stock } } } },
    },
    include: { variants: true },
  });
  return { product, variant: product.variants[0]! };
}

export function guestOwner(): CartOwner {
  return { userId: null, guestTokenHash: sha256Hex(randomUUID()) };
}

export async function fillCart(db: PrismaClient, owner: CartOwner, items: { variantId: string; quantity: number }[], couponCode?: string) {
  const cart = await db.cart.create({
    data: {
      userId: owner.userId,
      guestTokenHash: owner.guestTokenHash,
      couponCode: couponCode ?? null,
      items: { create: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) },
    },
  });
  return cart;
}

export function checkoutInput(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    fullName: "Rahim Uddin",
    phone: "01712345678",
    email: "",
    district: "Dhaka",
    area: "Dhanmondi",
    addressLine: "House 5, Road 10",
    postalCode: "",
    paymentMethod: "COD",
    billingSameAsShipping: "on",
    acceptTerms: "on",
    ...overrides,
  };
}

export const SETTINGS = { commerce: DEFAULT_SETTINGS.commerce, general: DEFAULT_SETTINGS.general };

export async function stockOf(db: PrismaClient, variantId: string) {
  return (await db.inventory.findUniqueOrThrow({ where: { variantId } })).quantity;
}
