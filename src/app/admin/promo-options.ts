import "server-only";
import { prisma } from "@/server/db";
import { loadCategoryIndex } from "@/server/services/categories";

/** Option lists for promotion/coupon target pickers. */
export async function loadTargetOptions() {
  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
    loadCategoryIndex(prisma),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const categoryOptions: { id: string; name: string }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const node of categories.childrenOf(parentId)) {
      categoryOptions.push({ id: node.id, name: `${"— ".repeat(depth)}${node.name}` });
      walk(node.id, depth + 1);
    }
  };
  walk(null, 0);
  return {
    products: products.map((p) => ({ id: p.id, name: `${p.name} (${p.sku})` })),
    categories: categoryOptions,
    brands,
  };
}
