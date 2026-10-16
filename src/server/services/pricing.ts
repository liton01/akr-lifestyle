import type { Prisma } from "@prisma/client";
import { toMinor, toMinorOrNull } from "@/lib/money";
import type { AutomaticDiscount, PricingContext, PricingProduct, PricingVariant } from "@/lib/pricing/engine";
import type { Db } from "@/server/db";
import { loadCategoryIndex, type CategoryIndex } from "@/server/services/categories";

export type LoadedPricingContext = PricingContext & { categories: CategoryIndex };

export async function loadLiveDiscounts(db: Db, now: Date): Promise<AutomaticDiscount[]> {
  const rows = await db.discount.findMany({
    where: {
      isActive: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    include: {
      products: { select: { id: true } },
      categories: { select: { id: true } },
      brands: { select: { id: true } },
    },
  });
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    value: toMinor(d.value),
    scope: d.scope,
    maxDiscountAmount: toMinorOrNull(d.maxDiscountAmount),
    badgeLabel: d.badgeLabel,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    isActive: d.isActive,
    productIds: new Set(d.products.map((p) => p.id)),
    categoryIds: new Set(d.categories.map((c) => c.id)),
    brandIds: new Set(d.brands.map((b) => b.id)),
  }));
}

export async function loadPricingContext(db: Db, now = new Date()): Promise<LoadedPricingContext> {
  const [discounts, categories] = await Promise.all([loadLiveDiscounts(db, now), loadCategoryIndex(db)]);
  return { now, discounts, categories, categoryLineage: categories.lineage };
}

type ProductPriceFields = {
  id: string;
  categoryId: string;
  brandId: string | null;
  price: Prisma.Decimal;
  compareAtPrice: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
};

type VariantPriceFields = {
  id: string;
  price: Prisma.Decimal | null;
  compareAtPrice: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
};

export function toPricingProduct(p: ProductPriceFields): PricingProduct {
  return {
    id: p.id,
    categoryId: p.categoryId,
    brandId: p.brandId,
    price: toMinor(p.price),
    compareAtPrice: toMinorOrNull(p.compareAtPrice),
    salePrice: toMinorOrNull(p.salePrice),
    saleStartsAt: p.saleStartsAt,
    saleEndsAt: p.saleEndsAt,
  };
}

export function toPricingVariant(v: VariantPriceFields): PricingVariant {
  return {
    id: v.id,
    price: toMinorOrNull(v.price),
    compareAtPrice: toMinorOrNull(v.compareAtPrice),
    salePrice: toMinorOrNull(v.salePrice),
  };
}

export const productPriceSelect = {
  id: true,
  categoryId: true,
  brandId: true,
  price: true,
  compareAtPrice: true,
  salePrice: true,
  saleStartsAt: true,
  saleEndsAt: true,
} as const;

export const variantPriceSelect = {
  id: true,
  price: true,
  compareAtPrice: true,
  salePrice: true,
} as const;
