import { History } from "lucide-react";
import Link from "next/link";
import { AdjustStockForm } from "@/components/admin/inventory-forms";
import { AdminPageHeader, EmptyRow, FilterBar, FilterField, filterInput, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { formatBDT } from "@/lib/money";
import { can } from "@/lib/permissions";
import { firstParam, parsePositiveInt } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { loadCategoryIndex } from "@/server/services/categories";
import { inventorySummary, listInventory, stockState, type InventorySort, type StockFilter } from "@/server/services/inventory";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const user = await requireStaffPage("inventory:read", "/admin/inventory");
  const params = await searchParams;
  const stock = (firstParam(params.stock) ?? "all") as StockFilter;
  const sort = (firstParam(params.sort) ?? "name") as InventorySort;
  const page = parsePositiveInt(params.page, 1, 1000);
  const [summary, categories, { rows, total }] = await Promise.all([
    inventorySummary(prisma),
    loadCategoryIndex(prisma),
    listInventory(prisma, {
      q: firstParam(params.q)?.trim() || undefined,
      stock: ["all", "in", "low", "out"].includes(stock) ? stock : "all",
      categoryId: firstParam(params.category) || undefined,
      sort: ["name", "stock-asc", "stock-desc", "updated"].includes(sort) ? sort : "name",
      page,
      pageSize: ADMIN_PAGE_SIZE,
    }),
  ]);
  const canAdjust = can(user.role, "inventory:adjust");

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        description="Stock per SKU (active, non-archived products). Every change is recorded in the movement history."
        actions={
          <ButtonLink href="/admin/inventory/movements" variant="outline" size="sm">
            <History className="h-4 w-4" /> Movement history
          </ButtonLink>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="SKUs" value={summary.skuCount} />
        <StatCard label="Units in stock" value={summary.totalUnits.toLocaleString("en-IN")} />
        <StatCard label="Low stock" value={summary.lowStock} tone={summary.lowStock ? "warning" : undefined} href="/admin/inventory?stock=low" />
        <StatCard label="Out of stock" value={summary.outOfStock} tone={summary.outOfStock ? "danger" : undefined} href="/admin/inventory?stock=out" />
        <StatCard
          label="Stock value"
          value={formatBDT(summary.retailValue)}
          hint={can(user.role, "product:view-cost") ? `At cost: ${formatBDT(summary.costValue)}` : "At selling price"}
        />
      </div>
      <FilterBar action="/admin/inventory" resetHref="/admin/inventory">
        <FilterField label="Search" htmlFor="q">
          <input id="q" name="q" defaultValue={firstParam(params.q) ?? ""} placeholder="Product or SKU" className={`${filterInput} w-56`} />
        </FilterField>
        <FilterField label="Stock" htmlFor="stock">
          <select id="stock" name="stock" defaultValue={stock} className={filterInput}>
            <option value="all">All</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
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
        <FilterField label="Sort" htmlFor="sort">
          <select id="sort" name="sort" defaultValue={sort} className={filterInput}>
            <option value="name">Product name</option>
            <option value="stock-asc">Stock: low → high</option>
            <option value="stock-desc">Stock: high → low</option>
            <option value="updated">Recently changed</option>
          </select>
        </FilterField>
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <Th>Product / variant</Th>
            <Th>SKU</Th>
            <Th>Category</Th>
            <Th align="right">In stock</Th>
            <Th align="right">Low at</Th>
            <Th>Status</Th>
            {canAdjust ? <Th align="right">Action</Th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => {
              const state = stockState(row.quantity, row.threshold);
              return (
                <tr key={row.variantId} className="hover:bg-ivory/40">
                  <Td>
                    <Link href={`/admin/products/${row.productId}`} className="font-medium hover:underline">
                      {row.productName}
                    </Link>
                    {!row.isDefault ? <span className="block text-xs text-muted">{row.variantName}</span> : null}
                    {row.productStatus === "DRAFT" ? <span className="block text-xs text-warning">Draft</span> : null}
                  </Td>
                  <Td className="font-mono text-xs">{row.sku}</Td>
                  <Td className="text-charcoal">{row.categoryName}</Td>
                  <Td align="right" className="font-semibold">
                    {row.quantity}
                  </Td>
                  <Td align="right" className="text-muted">
                    {row.threshold}
                  </Td>
                  <Td>
                    <Badge tone={state === "out" ? "danger" : state === "low" ? "warning" : "success"}>
                      {state === "out" ? "Out of stock" : state === "low" ? "Low stock" : "In stock"}
                    </Badge>
                  </Td>
                  {canAdjust ? (
                    <Td align="right" className="relative">
                      <div className="flex justify-end">
                        <AdjustStockForm variantId={row.variantId} current={row.quantity} />
                      </div>
                    </Td>
                  ) : null}
                </tr>
              );
            })
          ) : (
            <EmptyRow colSpan={canAdjust ? 7 : 6}>No stock records match these filters.</EmptyRow>
          )}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} basePath="/admin/inventory" searchParams={params} />
    </>
  );
}
