import { EMPTY_PRODUCT, ProductForm } from "@/components/admin/product-form";
import { AdminPageHeader } from "@/components/admin/ui";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { loadProductFormOptions } from "../options";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const user = await requireStaffPage("product:write", "/admin/products/new");
  const options = await loadProductFormOptions();
  return (
    <>
      <AdminPageHeader title="New product" back={{ href: "/admin/products", label: "Products" }} />
      <ProductForm initial={EMPTY_PRODUCT} {...options} canViewCost={can(user.role, "product:view-cost")} />
    </>
  );
}
