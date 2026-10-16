import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ProductForm } from "@/components/admin/product-form";
import { AdminPageHeader } from "@/components/admin/ui";
import { Alert } from "@/components/ui/feedback";
import { can } from "@/lib/permissions";
import { firstParam } from "@/lib/utils";
import { deleteProductAction, setProductStatusAction } from "@/server/actions/admin/catalog";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getProductFormValues } from "@/server/services/products";
import { loadProductFormOptions } from "../options";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const user = await requireStaffPage("product:read", `/admin/products/${id}`);
  const canCost = can(user.role, "product:view-cost");
  const [values, options, orderCount] = await Promise.all([
    getProductFormValues(prisma, id, canCost),
    loadProductFormOptions(),
    prisma.orderItem.count({ where: { productId: id } }),
  ]);
  if (!values) notFound();
  const query = await searchParams;
  const canWrite = can(user.role, "product:write");

  return (
    <>
      <AdminPageHeader
        title={values.name}
        description={`SKU ${values.sku}${orderCount ? ` · ordered ${orderCount} time${orderCount === 1 ? "" : "s"}` : ""}`}
        back={{ href: "/admin/products", label: "Products" }}
        actions={
          <>
            {values.status === "ACTIVE" ? (
              <Link href={`/product/${values.slug}`} target="_blank" className="inline-flex h-8 items-center gap-1 rounded-md border border-line px-3 text-sm hover:bg-ivory">
                View in store <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
            {canWrite && values.status !== "ARCHIVED" ? (
              <ActionButton action={setProductStatusAction} fields={{ id, status: "ARCHIVED" }} confirm={{ title: "Archive this product?", description: "It will be hidden from the store but kept for order history." }}>
                Archive
              </ActionButton>
            ) : null}
            {canWrite && values.status === "ARCHIVED" ? (
              <ActionButton action={setProductStatusAction} fields={{ id, status: "DRAFT" }}>
                Restore as draft
              </ActionButton>
            ) : null}
            {can(user.role, "product:delete") && orderCount === 0 ? (
              <ActionButton
                action={deleteProductAction}
                fields={{ id }}
                variant="danger"
                confirm={{ title: "Delete this product permanently?", description: "This cannot be undone. Products with order history must be archived instead.", confirmLabel: "Delete" }}
              >
                Delete
              </ActionButton>
            ) : null}
          </>
        }
      />
      {firstParam(query.created) ? (
        <Alert tone="success" className="mb-4">
          Product created.
        </Alert>
      ) : null}
      {canWrite ? (
        <ProductForm key={`${id}-${values.status}`} initial={values} {...options} canViewCost={canCost} />
      ) : (
        <Alert tone="info">You can view products but not edit them.</Alert>
      )}
    </>
  );
}
