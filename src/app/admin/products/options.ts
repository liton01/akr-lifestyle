import "server-only";
import { prisma } from "@/server/db";
import { loadCategoryIndex } from "@/server/services/categories";

export async function loadProductFormOptions() {
  const [categories, brands, attributes] = await Promise.all([
    loadCategoryIndex(prisma),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.attribute.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, values: { orderBy: [{ sortOrder: "asc" }, { value: "asc" }], select: { id: true, value: true } } },
    }),
  ]);
  // Depth-first order so subcategories appear under their parents.
  const ordered: { id: string; name: string; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const node of categories.childrenOf(parentId)) {
      ordered.push({ id: node.id, name: node.isActive ? node.name : `${node.name} (inactive)`, depth });
      walk(node.id, depth + 1);
    }
  };
  walk(null, 1);
  return { categories: ordered, brands, attributes };
}
