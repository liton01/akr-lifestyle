import { Download } from "lucide-react";
import Link from "next/link";
import { PeriodFilter } from "@/components/admin/period-filter";
import { AdminPageHeader, Panel, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { formatBDT } from "@/lib/money";
import { can } from "@/lib/permissions";
import { buildQuery, firstParam } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { inventorySummary, listInventory } from "@/server/services/inventory";
import { resolvePeriod } from "@/server/services/period";
import { dailyTrend, salesSummary } from "@/server/services/reports";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const user = await requireStaffPage("reports:inventory", "/admin/reports");
  const params = await searchParams;
  const settings = await getSettings();
  const tz = settings.general.timeZone;
  const period = resolvePeriod({ range: firstParam(params.range), from: firstParam(params.from), to: firstParam(params.to) }, tz);
  const canSales = can(user.role, "reports:view");
  const canCost = can(user.role, "product:view-cost");

  const [inventory, low, out, sales, trend] = await Promise.all([
    inventorySummary(prisma),
    listInventory(prisma, { stock: "low", sort: "stock-asc", page: 1, pageSize: 50 }),
    listInventory(prisma, { stock: "out", sort: "name", page: 1, pageSize: 50 }),
    canSales ? salesSummary(prisma, period.from, period.to) : Promise.resolve(null),
    canSales ? dailyTrend(prisma, period.from, period.to, tz) : Promise.resolve([]),
  ]);
  const exportQuery = period.preset === "custom" ? buildQuery({ from: period.fromInput, to: period.toInput }) : buildQuery({ range: period.preset });

  return (
    <>
      <AdminPageHeader title="Reports" />
      {canSales && sales ? (
        <>
          <PeriodFilter basePath="/admin/reports" period={period} />
          <Panel
            title={`Sales report · ${period.label}`}
            className="mb-8"
            actions={
              <a href={`/admin/reports/export/orders${exportQuery}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-sm hover:bg-ivory">
                <Download className="h-4 w-4" /> Orders CSV
              </a>
            }
          >
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Gross sales" value={formatBDT(sales.grossSales)} hint={`${sales.ordersPlaced} orders placed`} />
              <StatCard label="Average order" value={formatBDT(sales.averageOrderValue)} />
              <StatCard label="Completed sales" value={formatBDT(sales.completedSales)} hint={`${sales.completedOrders} delivered`} />
              <StatCard label="Net sales" value={formatBDT(sales.netSales)} hint={`After ${formatBDT(sales.refunds)} refunds`} />
            </div>
            <div className="max-h-[28rem] overflow-y-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th align="right">Orders</Th>
                    <Th align="right">Gross sales</Th>
                    <Th align="right">Cancelled</Th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((p) => (
                    <tr key={p.day}>
                      <Td>{p.day}</Td>
                      <Td align="right">{p.orders}</Td>
                      <Td align="right">{formatBDT(p.gross)}</Td>
                      <Td align="right">{p.cancelled}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Panel>
        </>
      ) : null}

      <Panel
        title="Inventory report"
        description="Active and draft products (archived excluded)."
        actions={
          <a href="/admin/reports/export/inventory" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-sm hover:bg-ivory">
            <Download className="h-4 w-4" /> Inventory CSV
          </a>
        }
      >
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total units" value={inventory.totalUnits.toLocaleString("en-IN")} hint={`${inventory.skuCount} SKUs`} />
          <StatCard label="In stock" value={inventory.inStock} />
          <StatCard label="Low stock" value={inventory.lowStock} tone={inventory.lowStock ? "warning" : undefined} />
          <StatCard label="Out of stock" value={inventory.outOfStock} tone={inventory.outOfStock ? "danger" : undefined} />
          <StatCard label="Value" value={formatBDT(inventory.retailValue)} hint={canCost ? `At cost: ${formatBDT(inventory.costValue)}` : "At selling price"} />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          {[
            { title: "Low-stock products", rows: low.rows },
            { title: "Out-of-stock products", rows: out.rows },
          ].map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 font-sans text-sm font-semibold">
                {section.title} ({section.rows.length})
              </h3>
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>SKU</Th>
                    <Th align="right">Qty</Th>
                    <Th align="right">Threshold</Th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.length ? (
                    section.rows.map((r) => (
                      <tr key={r.variantId}>
                        <Td>
                          <Link href={`/admin/products/${r.productId}`} className="hover:underline">
                            {r.productName}
                          </Link>
                          {!r.isDefault ? <span className="block text-xs text-muted">{r.variantName}</span> : null}
                        </Td>
                        <Td className="font-mono text-xs">{r.sku}</Td>
                        <Td align="right">{r.quantity}</Td>
                        <Td align="right">{r.threshold}</Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                        None
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
