import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ReassignForm } from "@/components/admin/reassign-form";
import { BrandForm, type BrandFormValues } from "@/components/admin/taxonomy-forms";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { deleteBrandAction, reassignBrandAction } from "@/server/actions/admin/catalog";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const metadata = { title: "Brand" };

export default async function BrandEditPage({ params }: PageProps<"/admin/brands/[id]">) {
  const { id } = await params;
  await requireStaffPage("catalog:write", `/admin/brands/${id}`);
  const isNew = id === "new";
  const [brand, others, productCount] = await Promise.all([
    isNew ? null : prisma.brand.findUnique({ where: { id } }),
    prisma.brand.findMany({ where: { id: { not: id } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    isNew ? 0 : prisma.product.count({ where: { brandId: id } }),
  ]);
  if (!isNew && !brand) notFound();
  const initial: BrandFormValues = brand
    ? {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        description: brand.description ?? "",
        logoUrl: brand.logoUrl ?? "",
        website: brand.website ?? "",
        sortOrder: brand.sortOrder,
        isActive: brand.isActive,
      }
    : { id: null, name: "", slug: "", description: "", logoUrl: "", website: "", sortOrder: 0, isActive: true };

  return (
    <>
      <AdminPageHeader title={brand ? brand.name : "New brand"} back={{ href: "/admin/brands", label: "Brands" }} />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Panel>
          <BrandForm initial={initial} />
        </Panel>
        {brand ? (
          <div className="space-y-6">
            <Panel title="Products" description={`${productCount} product(s) use this brand.`}>
              {productCount > 0 ? <ReassignForm action={reassignBrandAction} id={brand.id} targets={others} label="Move all products to" allowNone /> : null}
            </Panel>
            <Panel title="Delete brand" description="Brands still used by products cannot be deleted. Deactivate it to hide it instead.">
              <ActionButton action={deleteBrandAction} fields={{ id: brand.id }} variant="danger" confirm={{ title: `Delete “${brand.name}”?`, confirmLabel: "Delete" }}>
                Delete brand
              </ActionButton>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}
