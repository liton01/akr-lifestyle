import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { CategoryForm, type CategoryFormValues } from "@/components/admin/taxonomy-forms";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { ReassignForm } from "@/components/admin/reassign-form";
import { deleteCategoryAction, reassignCategoryAction } from "@/server/actions/admin/catalog";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { buildCategoryIndex, categoryNodeSelect } from "@/server/services/categories";

export const metadata = { title: "Category" };

export default async function CategoryEditPage({ params }: PageProps<"/admin/categories/[id]">) {
  const { id } = await params;
  await requireStaffPage("catalog:write", `/admin/categories/${id}`);
  const isNew = id === "new";
  const [category, nodes, productCount] = await Promise.all([
    isNew ? null : prisma.category.findUnique({ where: { id } }),
    prisma.category.findMany({ select: categoryNodeSelect }),
    isNew ? 0 : prisma.product.count({ where: { categoryId: id } }),
  ]);
  if (!isNew && !category) notFound();
  const index = buildCategoryIndex(nodes);
  const excluded = new Set(category ? index.descendants(category.id) : []);
  const parents: { id: string; name: string; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const node of index.childrenOf(parentId)) {
      if (!excluded.has(node.id) && depth < 3) parents.push({ id: node.id, name: node.name, depth });
      walk(node.id, depth + 1);
    }
  };
  walk(null, 1);

  const initial: CategoryFormValues = category
    ? {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description ?? "",
        imageUrl: category.imageUrl ?? "",
        parentId: category.parentId ?? "",
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        seoTitle: category.seoTitle ?? "",
        seoDescription: category.seoDescription ?? "",
      }
    : { id: null, name: "", slug: "", description: "", imageUrl: "", parentId: "", sortOrder: 0, isActive: true, seoTitle: "", seoDescription: "" };

  const targets = nodes.filter((n) => n.id !== id).map((n) => ({ id: n.id, name: n.name }));

  return (
    <>
      <AdminPageHeader title={category ? category.name : "New category"} back={{ href: "/admin/categories", label: "Categories" }} />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Panel>
          <CategoryForm initial={initial} parents={parents} />
        </Panel>
        {category ? (
          <div className="space-y-6">
            <Panel title="Products" description={`${productCount} product(s) use this category.`}>
              {productCount > 0 ? <ReassignForm action={reassignCategoryAction} id={category.id} targets={targets} label="Move all products to" /> : null}
            </Panel>
            <Panel title="Delete category" description="Only empty categories without subcategories can be deleted. Deactivate it to hide it instead.">
              <ActionButton action={deleteCategoryAction} fields={{ id: category.id }} variant="danger" confirm={{ title: `Delete “${category.name}”?`, confirmLabel: "Delete" }}>
                Delete category
              </ActionButton>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}
