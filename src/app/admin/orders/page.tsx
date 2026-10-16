import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { Download } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader, EmptyRow, FilterBar, FilterField, filterInput, Table, Td, Th } from "@/components/admin/ui";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/store/order-view";
import { Pagination } from "@/components/ui/pagination";
import { ADMIN_PAGE_SIZE, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { formatBDT, toMinor } from "@/lib/money";
import { buildQuery, firstParam, parsePositiveInt } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { addDays, parseZonedDate } from "@/server/services/dates";
import { listAdminOrders } from "@/server/services/orders";

export const metadata = { title: "Orders" };

const STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];
const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[];

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireStaffPage("order:read", "/admin/orders");
  const params = await searchParams;
  const settings = await getSettings();
  const tz = settings.general.timeZone;
  const status = firstParam(params.status) as OrderStatus | undefined;
  const paymentStatus = firstParam(params.payment) as PaymentStatus | undefined;
  const method = firstParam(params.method) as "COD" | "SSLCOMMERZ" | undefined;
  const fromText = firstParam(params.from);
  const toText = firstParam(params.to);
  const from = parseZonedDate(fromText, tz);
  const toStart = parseZonedDate(toText, tz);
  const sort = (firstParam(params.sort) ?? "newest") as "newest" | "oldest" | "total-desc" | "total-asc";
  const page = parsePositiveInt(params.page, 1, 1000);

  const { rows, total } = await listAdminOrders(prisma, {
    q: firstParam(params.q)?.trim() || undefined,
    status: status && STATUSES.includes(status) ? status : undefined,
    paymentStatus: paymentStatus && PAYMENT_STATUSES.includes(paymentStatus) ? paymentStatus : undefined,
    paymentMethod: method === "COD" || method === "SSLCOMMERZ" ? method : undefined,
    from,
    to: toStart ? addDays(toStart, 1) : null,
    sort,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  });

  const exportQuery = buildQuery({ from: fromText, to: toText });

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"}`}
        actions={
          <a href={`/admin/reports/export/orders${exportQuery}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-sm hover:bg-ivory">
            <Download className="h-4 w-4" /> Export CSV
          </a>
        }
      />
      <FilterBar action="/admin/orders" resetHref="/admin/orders">
        <FilterField label="Search" htmlFor="q">
          <input id="q" name="q" defaultValue={firstParam(params.q) ?? ""} placeholder="Order no., name or phone" className={`${filterInput} w-56`} />
        </FilterField>
        <FilterField label="Status" htmlFor="status">
          <select id="status" name="status" defaultValue={status ?? ""} className={filterInput}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Payment" htmlFor="payment">
          <select id="payment" name="payment" defaultValue={paymentStatus ?? ""} className={filterInput}>
            <option value="">All</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Method" htmlFor="method">
          <select id="method" name="method" defaultValue={method ?? ""} className={filterInput}>
            <option value="">All</option>
            <option value="COD">Cash on delivery</option>
            <option value="SSLCOMMERZ">Online</option>
          </select>
        </FilterField>
        <FilterField label="From" htmlFor="from">
          <input id="from" name="from" type="date" defaultValue={fromText ?? ""} className={filterInput} />
        </FilterField>
        <FilterField label="To" htmlFor="to">
          <input id="to" name="to" type="date" defaultValue={toText ?? ""} className={filterInput} />
        </FilterField>
        <FilterField label="Sort" htmlFor="sort">
          <select id="sort" name="sort" defaultValue={sort} className={filterInput}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="total-desc">Total: high → low</option>
            <option value="total-asc">Total: low → high</option>
          </select>
        </FilterField>
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <Th>Order</Th>
            <Th>Customer</Th>
            <Th>Date</Th>
            <Th>Status</Th>
            <Th>Payment</Th>
            <Th align="right">Total</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((o) => (
              <tr key={o.id} className="hover:bg-ivory/40">
                <Td>
                  <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm font-semibold hover:underline">
                    {o.orderNumber}
                  </Link>
                  <span className="block text-xs text-muted">
                    {o._count.items} item{o._count.items === 1 ? "" : "s"} · {o.shippingDistrict}
                  </span>
                </Td>
                <Td>
                  <span className="block">{o.customerName}</span>
                  <span className="block text-xs text-muted">{o.customerPhone}</span>
                </Td>
                <Td className="whitespace-nowrap text-xs text-muted">{o.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: tz })}</Td>
                <Td>
                  <OrderStatusBadge status={o.status} />
                </Td>
                <Td>
                  <PaymentStatusBadge status={o.paymentStatus} />
                  <span className="mt-0.5 block text-xs text-muted">{o.paymentMethod === "COD" ? "COD" : PAYMENT_METHOD_LABELS[o.paymentMethod].split(" (")[0]}</span>
                </Td>
                <Td align="right" className="font-medium">
                  {formatBDT(toMinor(o.total))}
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={6}>No orders match these filters.</EmptyRow>
          )}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} basePath="/admin/orders" searchParams={params} />
    </>
  );
}
