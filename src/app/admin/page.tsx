import Link from "next/link";
import { OrdersByDayChart, SalesByDayChart } from "@/components/admin/charts";
import { PeriodFilter } from "@/components/admin/period-filter";
import { AdminPageHeader, Panel, StatCard } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/store/order-view";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatBDT, toMinor } from "@/lib/money";
import { can } from "@/lib/permissions";
import { firstParam } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { addDays, startOfMonthInZone, startOfTodayInZone } from "@/server/services/dates";
import { resolvePeriod } from "@/server/services/period";
import { catalogCounts, dailyTrend, lowStockList, paymentMethodSplit, salesSummary, statusBreakdown, topProducts } from "@/server/services/reports";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireStaffPage("dashboard:view", "/admin");
  const params = await searchParams;
  const settings = await getSettings();
  const tz = settings.general.timeZone;
  const now = new Date();
  const period = resolvePeriod({ range: firstParam(params.range), from: firstParam(params.from), to: firstParam(params.to) }, tz, now);
  const showSales = can(user.role, "dashboard:view-sales");

  const todayStart = startOfTodayInZone(now, tz);
  const monthStart = startOfMonthInZone(now, tz);
  const [counts, lowStock] = await Promise.all([catalogCounts(prisma, now), lowStockList(prisma, 8)]);
  const sales = showSales
    ? await Promise.all([
        salesSummary(prisma, period.from, period.to),
        salesSummary(prisma, todayStart, addDays(todayStart, 1)),
        salesSummary(prisma, monthStart, addDays(todayStart, 1)),
        salesSummary(prisma, new Date(0), addDays(todayStart, 1)),
        dailyTrend(prisma, period.from, period.to, tz),
        topProducts(prisma, period.from, period.to, 6),
        paymentMethodSplit(prisma, period.from, period.to),
        statusBreakdown(prisma, period.from, period.to),
        prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, orderNumber: true, customerName: true, status: true, total: true, createdAt: true } }),
      ])
    : null;

  const s = counts.statusCounts;
  const processing = (s.CONFIRMED ?? 0) + (s.PROCESSING ?? 0) + (s.PACKED ?? 0) + (s.SHIPPED ?? 0);

  return (
    <>
      <AdminPageHeader title="Dashboard" description={`Welcome back, ${user.name.split(" ")[0]}. All figures come from live store data.`} />

      {sales ? (
        (() => {
          const [periodSales, today, month, allTime, trend, top, methods, periodStatus, recent] = sales;
          const periodTotal = Object.values(periodStatus).reduce((a, b) => a + (b ?? 0), 0);
          return (
            <>
              <PeriodFilter basePath="/admin" period={period} />
              <section aria-labelledby="sales-heading" className="mb-8">
                <h2 id="sales-heading" className="sr-only">
                  Sales for {period.label}
                </h2>
                <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
                  <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">Gross sales · {period.label}</p>
                    <p className="mt-2 font-sans text-5xl font-semibold text-ink">{formatBDT(periodSales.grossSales)}</p>
                    <p className="mt-2 text-sm text-muted">
                      {periodSales.ordersPlaced} order{periodSales.ordersPlaced === 1 ? "" : "s"} placed · average {formatBDT(periodSales.averageOrderValue)}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard label="Completed sales" value={formatBDT(periodSales.completedSales)} hint={`${periodSales.completedOrders} delivered in period`} />
                    <StatCard label="Refunds" value={formatBDT(periodSales.refunds)} hint="Recorded in period" />
                    <StatCard label="Net sales" value={formatBDT(periodSales.netSales)} hint="Completed − refunds" />
                    <StatCard label="Sales today" value={formatBDT(today.grossSales)} hint={`${today.ordersPlaced} order(s)`} />
                    <StatCard label="Sales this month" value={formatBDT(month.grossSales)} hint={`${month.ordersPlaced} order(s)`} />
                    <StatCard label="Cancelled" value={periodSales.cancelledOrders} hint={`${formatBDT(periodSales.cancelledValue)} in period`} tone={periodSales.cancelledOrders ? "warning" : undefined} />
                  </div>
                </div>
              </section>

              <div className="mb-8 grid gap-6 xl:grid-cols-2">
                <Panel title="Gross sales by day" description="Non-cancelled orders placed each day (BDT).">
                  <SalesByDayChart points={trend} />
                </Panel>
                <Panel title="Orders placed by day" description="Non-cancelled orders each day.">
                  <OrdersByDayChart points={trend} />
                </Panel>
              </div>

              <div className="mb-8 grid gap-6 xl:grid-cols-3">
                <Panel title="Orders by status" description={`Orders placed in period (${periodTotal}).`}>
                  <ul className="space-y-2">
                    {(Object.keys(ORDER_STATUS_LABELS) as (keyof typeof ORDER_STATUS_LABELS)[]).map((status) => {
                      const count = periodStatus[status] ?? 0;
                      const pct = periodTotal ? Math.round((count / periodTotal) * 100) : 0;
                      return (
                        <li key={status} className="text-sm">
                          <div className="flex justify-between">
                            <span>{ORDER_STATUS_LABELS[status]}</span>
                            <span className="tabular-nums text-muted">
                              {count} · {pct}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-ivory" aria-hidden="true">
                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: "#B07D2A" }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
                <Panel title="Top products" description="By units sold in period (net of returns).">
                  {top.length ? (
                    <ol className="space-y-2 text-sm">
                      {top.map((p, i) => (
                        <li key={p.productId ?? i} className="flex justify-between gap-3">
                          <span className="truncate">
                            {i + 1}. {p.productId ? <Link href={`/admin/products/${p.productId}`} className="hover:underline">{p.productName}</Link> : p.productName}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted">
                            {p.quantity} · {formatBDT(p.revenue)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted">No sales in this period.</p>
                  )}
                </Panel>
                <Panel title="Payment methods" description="Non-cancelled orders in period.">
                  {methods.length ? (
                    <ul className="space-y-2 text-sm">
                      {methods.map((m) => (
                        <li key={m.method} className="flex justify-between gap-3">
                          <span>{PAYMENT_METHOD_LABELS[m.method]}</span>
                          <span className="tabular-nums text-muted">
                            {m.orders} · {formatBDT(m.total)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">No orders in this period.</p>
                  )}
                  <div className="mt-4 border-t border-line pt-3 text-sm">
                    <p className="flex justify-between">
                      <span>Total net sales (all time)</span>
                      <strong className="tabular-nums">{formatBDT(allTime.netSales)}</strong>
                    </p>
                  </div>
                </Panel>
              </div>

              <Panel title="Recent orders" className="mb-8" actions={<Link href="/admin/orders" className="text-sm link">All orders</Link>}>
                <ul className="divide-y divide-line text-sm">
                  {recent.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono hover:underline">
                        {o.orderNumber}
                      </Link>
                      <span className="flex-1 truncate px-2">{o.customerName}</span>
                      <OrderStatusBadge status={o.status} />
                      <span className="w-28 text-right tabular-nums">{formatBDT(toMinor(o.total))}</span>
                    </li>
                  ))}
                  {recent.length === 0 ? <li className="py-4 text-muted">No orders yet.</li> : null}
                </ul>
              </Panel>
            </>
          );
        })()
      ) : null}

      <section aria-labelledby="ops-heading" className="mb-8">
        <h2 id="ops-heading" className="mb-3 font-sans text-sm font-semibold uppercase tracking-wider text-muted">
          Store at a glance (current)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
          <StatCard label="Total products" value={counts.totalProducts} hint="Excluding archived" href="/admin/products" />
          <StatCard label="Active products" value={counts.activeProducts} href="/admin/products?status=ACTIVE" />
          <StatCard label="Categories" value={counts.totalCategories} href="/admin/categories" />
          <StatCard label="Customers" value={counts.totalCustomers} href="/admin/customers" />
          <StatCard label="Total orders" value={counts.totalOrders} href="/admin/orders" />
          <StatCard label="Pending orders" value={s.PENDING ?? 0} tone={(s.PENDING ?? 0) > 0 ? "warning" : undefined} href="/admin/orders?status=PENDING" />
          <StatCard label="In progress" value={processing} hint="Confirmed → shipped" href="/admin/orders" />
          <StatCard label="Delivered" value={s.DELIVERED ?? 0} href="/admin/orders?status=DELIVERED" />
          <StatCard label="Cancelled" value={s.CANCELLED ?? 0} href="/admin/orders?status=CANCELLED" />
          <StatCard label="SKUs in stock" value={counts.inventory.inStock} href="/admin/inventory?stock=in" />
          <StatCard label="Low stock" value={counts.inventory.lowStock} tone={counts.inventory.lowStock ? "warning" : undefined} href="/admin/inventory?stock=low" />
          <StatCard label="Out of stock" value={counts.inventory.outOfStock} tone={counts.inventory.outOfStock ? "danger" : undefined} href="/admin/inventory?stock=out" />
          <StatCard label="Active coupons" value={counts.activeCoupons} href="/admin/coupons" />
          <StatCard label="Live promotions" value={counts.liveDiscounts} href="/admin/discounts" />
        </div>
      </section>

      <Panel title="Low-stock alerts" description="Active products at or below their low-stock threshold." actions={<Link href="/admin/inventory?stock=low" className="text-sm link">Inventory</Link>}>
        {lowStock.length ? (
          <ul className="divide-y divide-line text-sm">
            {lowStock.map((item) => (
              <li key={item.variantId} className="flex justify-between gap-3 py-2">
                <Link href={`/admin/products/${item.productId}`} className="truncate hover:underline">
                  {item.productName}
                  {item.variantName !== "Default" ? <span className="text-muted"> · {item.variantName}</span> : null}
                </Link>
                <span className={item.quantity <= 0 ? "font-semibold text-danger" : "font-semibold text-warning"}>
                  {item.quantity <= 0 ? "Out of stock" : `${item.quantity} left`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">All products are above their thresholds.</p>
        )}
      </Panel>

      {showSales ? (
        <details className="mt-8 rounded-xl border border-line bg-white p-5 text-sm text-charcoal">
          <summary className="cursor-pointer font-medium text-ink">How these numbers are calculated</summary>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li><strong>Gross sales</strong>: total of orders placed in the period, excluding cancelled orders (includes delivery fees, after discounts).</li>
            <li><strong>Completed sales</strong>: total of orders delivered in the period (by delivery date), including any later returned.</li>
            <li><strong>Refunds</strong>: refunds recorded in the period. <strong>Net sales</strong> = completed sales − refunds.</li>
            <li><strong>Cancelled</strong>: orders cancelled in the period and their value. Status counts in “Store at a glance” are current totals across all orders.</li>
            <li>Days and months follow the store time zone ({tz}).</li>
          </ul>
        </details>
      ) : null}
    </>
  );
}
