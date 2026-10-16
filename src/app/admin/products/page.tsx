import type { ProductStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AdminPageHeader, EmptyRow, FilterBar, FilterField, filterInput, Table, Td, Th } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { ADMIN_PAGE_SIZE, PRODUCT_STATUS_LABELS } from "@/lib/constants";
import { formatBDT } from "@/lib/money";
import { can } from "@/lib/permissions";
import { firstParam, parsePositiveInt } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { loadCategoryIndex } from "@/server/services/categories";
import { listAdminProducts, type AdminProductSort } from "@/server/services/products";

export const metadata = { title: "Products" };

const STATUSES: ProductStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const user = await requireStaffPage("product:read", "/admin/products");
  const params = await searchParams;
  const status = firstParam(params.status) as ProductStatus | undefined;
  const flag = firstParam(params.flag) as "featured" | "new" | "bestseller" | undefined;
  const sort = (firstParam(params.sort) as AdminProductSort | undefined) ?? "updated";
  const page = parsePositiveInt(params.page, 1, 1000);
  const [categories, brands, { rows, total }] = await Promise.all([
    loadCategoryIndex(prisma),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listAdminProducts(prisma, {
      q: firstParam(params.q)?.trim() || undefined,
      status: status && STATUSES.includes(status) ? status : undefined,
      categoryId: firstParam(params.category) || undefined,
      brandId: firstParam(params.brand) || undefined,
      flag: flag && ["featured", "new", "bestseller"].includes(flag) ? flag : undefined,
      sort,
      page,
      pageSize: ADMIN_PAGE_SIZE,
    }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Products"
        description={`${total} product${total === 1 ? "" : "s"}`}
        actions={
          can(user.role, "product:write") ? (
            <ButtonLink href="/admin/products/new">
              <Plus className="h-4 w-4" /> New product
            </ButtonLink>
          ) : null
        }
      />
      {firstParam(params.deleted) ? <Alert tone="success" className="mb-4">Product deleted.</Alert> : null}
      <FilterBar action="/admin/products" resetHref="/admin/products">
        <FilterField label="Search" htmlFor="q">
          <input id="q" name="q" defaultValue={firstParam(params.q) ?? ""} placeholder="Name, SKU, brand…" className={`${filterInput} w-56`} />
        </FilterField>
        <FilterField label="Status" htmlFor="status">
          <select id="status" name="status" defaultValue={status ?? ""} className={filterInput}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {PRODUCT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Category" htmlFor="category">
          <select id="category" name="category" defaultValue={firstParam(params.category) ?? ""} className={filterInput}>
            <option value="">All</option>
            {categories.nodes.map((c) => (
              <option key={c.id} value={c.id}>
                {"— ".repeat(categories.depth(c.id) - 1)}
                {c.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Brand" htmlFor="brand">
          <select id="brand" name="brand" defaultValue={firstParam(params.brand) ?? ""} className={filterInput}>
            <option value="">All</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Flag" htmlFor="flag">
          <select id="flag" name="flag" defaultValue={flag ?? ""} className={filterInput}>
            <option value="">Any</option>
            <option value="featured">Featured</option>
            <option value="new">New arrival</option>
            <option value="bestseller">Best seller</option>
          </select>
        </FilterField>
        <FilterField label="Sort" htmlFor="sort">
          <select id="sort" name="sort" defaultValue={sort} className={filterInput}>
            <option value="updated">Recently updated</option>
            <option value="newest">Newest</option>
            <option value="name">Name</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
            <option value="sold">Best selling</option>
          </select>
        </FilterField>
      </FilterBar>

      <Table>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Category</Th>
            <Th align="right">Price</Th>
            <Th align="right">Stock</Th>
            <Th align="right">Sold</Th>
            <Th>Status</Th>
            <Th>Updated</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((p) => (
              <tr key={p.id} className="hover:bg-ivory/40">
                <Td>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-ivory">
                      {p.imageUrl ? <Image src={p.imageUrl} alt="" fill sizes="44px" className="object-cover" /> : null}
                    </span>
                    <span>
                      <span className="block font-medium hover:underline">{p.name}</span>
                      <span className="block text-xs text-muted">
                        {p.sku}
                        {p.variantCount > 1 ? ` · ${p.variantCount} variants` : ""}
                        {p.brandName ? ` · ${p.brandName}` : ""}
                      </span>
                    </span>
                  </Link>
                </Td>
                <Td className="text-charcoal">{p.categoryName}</Td>
                <Td align="right">
                  {formatBDT(p.price)}
                  {p.salePrice !== null ? <span className="block text-xs text-gold-deep">Sale {formatBDT(p.salePrice)}</span> : null}
                </Td>
                <Td align="right">
                  <span className={p.stock <= 0 ? "font-medium text-danger" : p.stock <= p.lowStockThreshold ? "font-medium text-warning" : ""}>{p.stock}</span>
                </Td>
                <Td align="right">{p.soldCount}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={p.status === "ACTIVE" ? "success" : p.status === "DRAFT" ? "warning" : "neutral"}>{PRODUCT_STATUS_LABELS[p.status]}</Badge>
                    {p.isFeatured ? <Badge tone="gold">Featured</Badge> : null}
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-xs text-muted">{p.updatedAt.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={7}>No products match these filters.</EmptyRow>
          )}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} basePath="/admin/products" searchParams={params} />
    </>
  );
}
