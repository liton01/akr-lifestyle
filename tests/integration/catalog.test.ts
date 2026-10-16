import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import { deleteBrand } from "@/server/services/brands";
import { deleteCategory, saveCategory } from "@/server/services/categories";
import { createProduct, deleteProduct, getProductFormValues, setProductStatus, updateProduct } from "@/server/services/products";
import { createActor, resetDatabase, seedBasics } from "./helpers";

const db = new PrismaClient();

afterAll(() => db.$disconnect());

async function attributes() {
  const color = await db.attribute.create({ data: { name: "Color", slug: "color", values: { create: [{ value: "Black" }, { value: "Silver" }] } }, include: { values: true } });
  const size = await db.attribute.create({ data: { name: "Size", slug: "size", values: { create: [{ value: "41mm" }, { value: "45mm" }] } }, include: { values: true } });
  return { color, size };
}

describe("product management", () => {
  beforeEach(() => resetDatabase(db));

  it("creates a simple product with opening stock and an inventory movement", async () => {
    const admin = await createActor(db, "ADMIN");
    const { child, brand } = await seedBasics(db);
    const product = await createProduct(db, admin, {
      name: "Fit Pro",
      sku: "fit-pro",
      description: "Smartwatch",
      categoryId: child.id,
      brandId: brand.id,
      price: "8990",
      costPrice: "5600",
      lowStockThreshold: "5",
      status: "ACTIVE",
      stock: "15",
    });
    expect(product.sku).toBe("FIT-PRO");
    expect(product.slug).toBe("fit-pro");
    const variant = await db.productVariant.findFirstOrThrow({ where: { productId: product.id }, include: { inventory: true } });
    expect(variant.isDefault).toBe(true);
    expect(variant.inventory?.quantity).toBe(15);
    const movement = await db.inventoryMovement.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(movement).toMatchObject({ type: "INITIAL_STOCK", quantityChange: 15, quantityAfter: 15 });
    expect(product.costPrice?.toFixed(2)).toBe("5600.00");
    expect(product.publishedAt).not.toBeNull();
  });

  it("creates and edits variants; removed variants with orders are deactivated, not deleted", async () => {
    const admin = await createActor(db, "ADMIN");
    const { child } = await seedBasics(db);
    const { color, size } = await attributes();
    const [black, silver] = color.values;
    const [s41, s45] = size.values;
    const base = { name: "Fit Pro", sku: "FP", description: "x", categoryId: child.id, price: "8990", lowStockThreshold: "5", status: "ACTIVE", hasVariants: true };
    const product = await createProduct(db, admin, {
      ...base,
      variants: [
        { sku: "FP-41-BLK", isActive: true, initialStock: "4", options: [{ attributeId: color.id, valueId: black!.id }, { attributeId: size.id, valueId: s41!.id }] },
        { sku: "FP-45-SLV", isActive: true, price: "9490", initialStock: "2", options: [{ attributeId: color.id, valueId: silver!.id }, { attributeId: size.id, valueId: s45!.id }] },
      ],
    });
    const variants = await db.productVariant.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" } });
    expect(variants.map((v) => v.name)).toEqual(["Black / 41mm", "Silver / 45mm"]);
    expect(variants[1]!.price?.toFixed(2)).toBe("9490.00");

    // Give the first variant order history, then remove both from the form.
    const order = await db.order.create({
      data: {
        orderNumber: "AKRTEST-1",
        idempotencyKey: crypto.randomUUID(),
        paymentMethod: "COD",
        customerName: "A",
        customerPhone: "01712345678",
        shippingAddress: {},
        shippingDistrict: "Dhaka",
        subtotal: "1",
        total: "1",
        items: { create: { productName: "Fit Pro", sku: "FP-41-BLK", variantId: variants[0]!.id, productId: product.id, originalUnitPrice: "1", finalUnitPrice: "1", quantity: 1, lineSubtotal: "1", lineTotal: "1" } },
      },
    });
    expect(order.id).toBeTruthy();
    await updateProduct(db, admin, product.id, {
      ...base,
      variants: [{ sku: "FP-NEW", isActive: true, initialStock: "1", options: [{ attributeId: color.id, valueId: silver!.id }, { attributeId: size.id, valueId: s41!.id }] }],
    });
    const after = await db.productVariant.findMany({ where: { productId: product.id } });
    expect(after.find((v) => v.sku === "FP-41-BLK")?.isActive).toBe(false); // kept for history
    expect(after.find((v) => v.sku === "FP-45-SLV")).toBeUndefined(); // never ordered → deleted
    expect(after.find((v) => v.sku === "FP-NEW")?.isActive).toBe(true);
  });

  it("rejects duplicate SKUs across products", async () => {
    const admin = await createActor(db, "ADMIN");
    const { child } = await seedBasics(db);
    const input = { name: "One", sku: "DUP-1", description: "x", categoryId: child.id, price: "100", lowStockThreshold: "1", status: "DRAFT" };
    await createProduct(db, admin, input);
    await expect(createProduct(db, admin, { ...input, name: "Two" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("keeps the cost price unchanged when a role without cost access edits the product", async () => {
    const admin = await createActor(db, "ADMIN");
    const manager = await createActor(db, "STORE_MANAGER");
    const { child } = await seedBasics(db);
    const input = { name: "Ring", sku: "RING-1", description: "x", categoryId: child.id, price: "1000", costPrice: "600", lowStockThreshold: "1", status: "ACTIVE" };
    const product = await createProduct(db, admin, input);
    await updateProduct(db, manager, product.id, { ...input, price: "1100", costPrice: "1" });
    const saved = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(saved.price.toFixed(2)).toBe("1100.00");
    expect(saved.costPrice?.toFixed(2)).toBe("600.00");
    const formForManager = await getProductFormValues(db, product.id, false);
    expect(formForManager?.costPrice).toBe("");
  });

  it("enforces permissions on the server", async () => {
    const inventoryManager = await createActor(db, "INVENTORY_MANAGER");
    const customer = await createActor(db, "CUSTOMER");
    const { child } = await seedBasics(db);
    const input = { name: "Product X", sku: "X-1", description: "x", categoryId: child.id, price: "100", lowStockThreshold: "1", status: "DRAFT" };
    await expect(createProduct(db, inventoryManager, input)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createProduct(db, customer, input)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("archives and restores, and refuses to hard-delete products with orders", async () => {
    const admin = await createActor(db, "ADMIN");
    const { child } = await seedBasics(db);
    const product = await createProduct(db, admin, { name: "Product P", sku: "P-1", description: "x", categoryId: child.id, price: "100", lowStockThreshold: "1", status: "ACTIVE" });
    const archived = await setProductStatus(db, admin, product.id, "ARCHIVED");
    expect(archived.archivedAt).not.toBeNull();
    const restored = await setProductStatus(db, admin, product.id, "DRAFT");
    expect(restored.archivedAt).toBeNull();

    const variant = await db.productVariant.findFirstOrThrow({ where: { productId: product.id } });
    await db.order.create({
      data: {
        orderNumber: "AKRTEST-2",
        idempotencyKey: crypto.randomUUID(),
        paymentMethod: "COD",
        customerName: "A",
        customerPhone: "01712345678",
        shippingAddress: {},
        shippingDistrict: "Dhaka",
        subtotal: "1",
        total: "1",
        items: { create: { productName: "P", sku: "P-1", variantId: variant.id, productId: product.id, originalUnitPrice: "1", finalUnitPrice: "1", quantity: 1, lineSubtotal: "1", lineTotal: "1" } },
      },
    });
    await expect(deleteProduct(db, admin, product.id)).rejects.toBeInstanceOf(ConflictError);
    const clean = await createProduct(db, admin, { name: "Product Q", sku: "Q-1", description: "x", categoryId: child.id, price: "100", lowStockThreshold: "1", status: "DRAFT" });
    await deleteProduct(db, admin, clean.id);
    expect(await db.product.findUnique({ where: { id: clean.id } })).toBeNull();
  });

  it("blocks deleting categories and brands that are still referenced", async () => {
    const admin = await createActor(db, "ADMIN");
    const { category, child, brand } = await seedBasics(db);
    await createProduct(db, admin, { name: "Product P9", sku: "P-9", description: "x", categoryId: child.id, brandId: brand.id, price: "100", lowStockThreshold: "1", status: "DRAFT" });
    await expect(deleteCategory(db, admin, category.id)).rejects.toBeInstanceOf(ConflictError); // has a subcategory
    await expect(deleteCategory(db, admin, child.id)).rejects.toBeInstanceOf(ConflictError); // has products
    await expect(deleteBrand(db, admin, brand.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("prevents category cycles and excessive nesting", async () => {
    const admin = await createActor(db, "ADMIN");
    const top = await saveCategory(db, admin, null, { name: "Top", sortOrder: "0", isActive: "on" });
    const mid = await saveCategory(db, admin, null, { name: "Mid", parentId: top.id, sortOrder: "0", isActive: "on" });
    const leaf = await saveCategory(db, admin, null, { name: "Leaf", parentId: mid.id, sortOrder: "0", isActive: "on" });
    await expect(saveCategory(db, admin, null, { name: "Too deep", parentId: leaf.id, sortOrder: "0" })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveCategory(db, admin, top.id, { name: "Top", parentId: leaf.id, sortOrder: "0" })).rejects.toBeInstanceOf(ValidationError);
  });
});
