import { MAX_CATEGORY_DEPTH } from "@/lib/constants";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { categoryInputSchema } from "@/lib/validation/catalog";
import { diffRecords, writeAudit } from "@/server/audit";
import type { Db } from "@/server/db";
import { assertPermission } from "@/server/services/authz";
import { uniqueSlug } from "@/server/services/slug";

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  imageUrl: string | null;
  description: string | null;
};

export type CategoryIndex = {
  nodes: CategoryNode[];
  byId: Map<string, CategoryNode>;
  bySlug: Map<string, CategoryNode>;
  childrenOf: (parentId: string | null) => CategoryNode[];
  /** The category id followed by its ancestors (closest first). */
  lineage: (id: string) => string[];
  /** The category id plus every descendant id. */
  descendants: (id: string) => string[];
  /** Root-to-node path. */
  path: (id: string) => CategoryNode[];
  depth: (id: string) => number;
};

export const categoryNodeSelect = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
  isActive: true,
  sortOrder: true,
  imageUrl: true,
  description: true,
} as const;

export function buildCategoryIndex(input: CategoryNode[]): CategoryIndex {
  const nodes = [...input].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const bySlug = new Map(nodes.map((n) => [n.slug, n]));
  const children = new Map<string | null, CategoryNode[]>();
  for (const node of nodes) {
    const key = node.parentId && byId.has(node.parentId) ? node.parentId : null;
    const list = children.get(key) ?? [];
    list.push(node);
    children.set(key, list);
  }
  const lineage = (id: string) => {
    const out: string[] = [];
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      out.push(current.id);
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return out.length ? out : [id];
  };
  const descendants = (id: string) => {
    const out: string[] = [];
    const stack = [id];
    const seen = new Set<string>();
    while (stack.length) {
      const next = stack.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      out.push(next);
      for (const child of children.get(next) ?? []) stack.push(child.id);
    }
    return out;
  };
  return {
    nodes,
    byId,
    bySlug,
    childrenOf: (parentId) => children.get(parentId) ?? [],
    lineage,
    descendants,
    path: (id) =>
      lineage(id)
        .map((cid) => byId.get(cid))
        .filter((n): n is CategoryNode => Boolean(n))
        .reverse(),
    depth: (id) => lineage(id).length,
  };
}

export async function loadCategoryIndex(db: Db): Promise<CategoryIndex> {
  const nodes = await db.category.findMany({ select: categoryNodeSelect });
  return buildCategoryIndex(nodes);
}

function subtreeHeight(index: CategoryIndex, id: string): number {
  const children = index.childrenOf(id);
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map((c) => subtreeHeight(index, c.id)));
}

export async function saveCategory(db: Db, actor: Actor, id: string | null, raw: unknown) {
  assertPermission(actor, "catalog:write");
  const input = categoryInputSchema.parse(raw);
  const index = await loadCategoryIndex(db);

  if (input.parentId) {
    if (!index.byId.has(input.parentId)) throw new ValidationError("Parent category not found.", { parentId: ["Choose a valid parent."] });
    if (id && index.descendants(id).includes(input.parentId)) {
      throw new ValidationError("A category cannot be placed inside itself.", { parentId: ["Choose a different parent."] });
    }
    const parentDepth = index.depth(input.parentId);
    const height = id ? subtreeHeight(index, id) : 1;
    if (parentDepth + height > MAX_CATEGORY_DEPTH) {
      throw new ValidationError(`Categories can be nested at most ${MAX_CATEGORY_DEPTH} levels deep.`, {
        parentId: ["This would exceed the maximum depth."],
      });
    }
  }

  const slug =
    input.slug ||
    (await uniqueSlug(input.name, async (candidate) => {
      const existing = await db.category.findUnique({ where: { slug: candidate }, select: { id: true } });
      return Boolean(existing && existing.id !== id);
    }));

  const data = {
    name: input.name,
    slug,
    description: input.description,
    imageUrl: input.imageUrl || null,
    parentId: input.parentId,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
  };

  try {
    if (id) {
      const before = await db.category.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Category not found.");
      const updated = await db.category.update({ where: { id }, data });
      await writeAudit(db, actor, {
        action: "category.update",
        entityType: "Category",
        entityId: id,
        metadata: diffRecords(before, updated) as never,
      });
      return updated;
    }
    const created = await db.category.create({ data });
    await writeAudit(db, actor, { action: "category.create", entityType: "Category", entityId: created.id, metadata: { name: created.name } });
    return created;
  } catch (error) {
    if (isUniqueViolation(error, "slug")) throw new ValidationError("That slug is already used.", { slug: ["Choose a different slug."] });
    throw error;
  }
}

export async function deleteCategory(db: Db, actor: Actor, id: string) {
  assertPermission(actor, "catalog:write");
  const category = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!category) throw new NotFoundError("Category not found.");
  if (category._count.children > 0) {
    throw new ConflictError("Move or delete the subcategories first.");
  }
  if (category._count.products > 0) {
    throw new ConflictError(
      `${category._count.products} product(s) still use this category. Move them to another category or deactivate the category instead.`,
    );
  }
  await db.category.delete({ where: { id } });
  await writeAudit(db, actor, { action: "category.delete", entityType: "Category", entityId: id, metadata: { name: category.name } });
}

/** Move every product from one category to another (so the source can be deleted). */
export async function reassignCategoryProducts(db: Db, actor: Actor, fromId: string, toId: string) {
  assertPermission(actor, "catalog:write");
  if (fromId === toId) throw new ValidationError("Choose a different target category.");
  const target = await db.category.findUnique({ where: { id: toId }, select: { id: true } });
  if (!target) throw new NotFoundError("Target category not found.");
  const result = await db.product.updateMany({ where: { categoryId: fromId }, data: { categoryId: toId } });
  await writeAudit(db, actor, {
    action: "category.reassign-products",
    entityType: "Category",
    entityId: fromId,
    metadata: { to: toId, count: result.count },
  });
  return result.count;
}
