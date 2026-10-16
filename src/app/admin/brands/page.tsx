import { Plus } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader, EmptyRow, Table, Td, Th } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { can } from "@/lib/permissions";
import { firstParam } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const metadata = { title: "Brands" };

export default async function BrandsAdminPage({ searchParams }: PageProps<"/admin/brands">) {
  const user = await requireStaffPage("product:read", "/admin/brands");
  const params = await searchParams;
  const brands = await prisma.brand.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return (
    <>
      <AdminPageHeader
        title="Brands"
        actions={
          can(user.role, "catalog:write") ? (
            <ButtonLink href="/admin/brands/new">
              <Plus className="h-4 w-4" /> New brand
            </ButtonLink>
          ) : null
        }
      />
      {firstParam(params.saved) ? <Alert tone="success" className="mb-4">Brand saved.</Alert> : null}
      {firstParam(params.deleted) ? <Alert tone="success" className="mb-4">Brand deleted.</Alert> : null}
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Slug</Th>
            <Th align="right">Products</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {brands.length ? (
            brands.map((b) => (
              <tr key={b.id} className="hover:bg-ivory/40">
                <Td>
                  <Link href={`/admin/brands/${b.id}`} className="font-medium hover:underline">
                    {b.name}
                  </Link>
                </Td>
                <Td className="font-mono text-xs text-muted">{b.slug}</Td>
                <Td align="right">{b._count.products}</Td>
                <Td>{b.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={4}>No brands yet.</EmptyRow>
          )}
        </tbody>
      </Table>
    </>
  );
}
