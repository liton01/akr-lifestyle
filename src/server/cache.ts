import "server-only";
import { unstable_cache, updateTag } from "next/cache";
import { cache } from "react";
import { prisma } from "@/server/db";
import { buildCategoryIndex, categoryNodeSelect } from "@/server/services/categories";
import { loadStoreSettings } from "@/server/services/settings";

/**
 * Cross-request caches for rarely-changing storefront data. Every admin write path calls the
 * matching invalidate*() helper, so updates are visible immediately on that server. Entries
 * also expire after 5 minutes, which bounds staleness after out-of-band database changes
 * (seeding, scripts) and on other instances in a multi-server deployment. Admin screens
 * always read the database directly.
 */
export const CACHE_TAGS = {
  settings: "settings",
  categories: "categories",
  brands: "brands",
} as const;

const settingsCache = unstable_cache(() => loadStoreSettings(prisma), ["store-settings"], {
  tags: [CACHE_TAGS.settings],
  revalidate: 300,
});

const categoryNodesCache = unstable_cache(() => prisma.category.findMany({ select: categoryNodeSelect }), ["category-nodes"], {
  tags: [CACHE_TAGS.categories],
  revalidate: 300,
});

const brandsCache = unstable_cache(
  () =>
    prisma.brand.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, logoUrl: true, description: true },
    }),
  ["active-brands"],
  { tags: [CACHE_TAGS.brands], revalidate: 300 },
);

export const getSettings = cache(() => settingsCache());
export const getCategoryIndex = cache(async () => buildCategoryIndex(await categoryNodesCache()));
export const getActiveBrands = cache(() => brandsCache());

export function invalidateSettings() {
  updateTag(CACHE_TAGS.settings);
}
export function invalidateCategories() {
  updateTag(CACHE_TAGS.categories);
}
export function invalidateBrands() {
  updateTag(CACHE_TAGS.brands);
}
