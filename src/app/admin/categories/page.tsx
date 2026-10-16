import { Plus } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader, EmptyRow, Table, Td, Th } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { can } from "@/lib/permissions";
import { firstParam } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { buildCategoryIndex, categoryNodeSelect } from "@/server/services/categories";

export const metadata = { title: "Categories" };

export default async function CategoriesPage({ searchParams }: PageProps<"/admin/categories">) {
  const user = await requireStaffPage("product:read", "/admin/categories");
  const params = await searchParams;
  const [nodes, counts] = await Promise.all([
    prisma.category.findMany({ select: categoryNodeSelect }),
    prisma.product.groupBy({ by: ["categoryId"], _count: true }),
  ]);
  const index = buildCategoryIndex(nodes);
  const countById = new Map(counts.map((c) => [c.categoryId, c._count]));
  const rows: { id: string; name: string; slug: string; depth: number; isActive: boolean; sortOrder: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const node of index.childrenOf(parentId)) {
      rows.push({ id: node.id, name: node.name, slug: node.slug, depth, isActive: node.isActive, sortOrder: node.sortOrder });
      walk(node.id, depth + 1);
    }
  };
  walk(null, 1);

  return (
    <>
      <AdminPageHeader
        title="Categories"
        description="Nested up to three levels. Products can be assigned to any level."
        actions={
          can(user.role, "catalog:write") ? (
            <ButtonLink href="/admin/categories/new">
              <Plus className="h-4 w-4" /> New category
            </ButtonLink>
          ) : null
        }
      />
      {firstParam(params.saved) ? <Alert tone="success" className="mb-4">Category saved.</Alert> : null}
      {firstParam(params.deleted) ? <Alert tone="success" className="mb-4">Category deleted.</Alert> : null}
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Slug</Th>
            <Th align="right">Products</Th>
            <Th align="right">Order</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id} className="hover:bg-ivory/40">
                <Td>
                  <Link href={`/admin/categories/${row.id}`} className="font-medium hover:underline" style={{ paddingLeft: `${(row.depth - 1) * 1.25}rem` }}>
                    {row.depth > 1 ? <span className="mr-1 text-muted">└</span> : null}
                    {row.name}
                  </Link>
                </Td>
                <Td className="font-mono text-xs text-muted">{row.slug}</Td>
                <Td align="right">{countById.get(row.id) ?? 0}</Td>
                <Td align="right">{row.sortOrder}</Td>
                <Td>{row.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={5}>No categories yet.</EmptyRow>
          )}
        </tbody>
      </Table>
    </>
  );
}
