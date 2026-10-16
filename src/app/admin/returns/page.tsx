import type { ReturnStatus } from "@prisma/client";
import Link from "next/link";
import { AdminPageHeader, EmptyRow, FilterBar, FilterField, filterInput, Table, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { ADMIN_PAGE_SIZE, RETURN_STATUS_LABELS } from "@/lib/constants";
import { firstParam, parsePositiveInt } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";

export const metadata = { title: "Returns" };

const STATUSES = Object.keys(RETURN_STATUS_LABELS) as ReturnStatus[];

export default async function ReturnsPage({ searchParams }: PageProps<"/admin/returns">) {
  await requireStaffPage("order:read", "/admin/returns");
  const params = await searchParams;
  const status = firstParam(params.status) as ReturnStatus | undefined;
  const page = parsePositiveInt(params.page, 1, 1000);
  const where = status && STATUSES.includes(status) ? { status } : {};
  const [settings, rows, total] = await Promise.all([
    getSettings(),
    prisma.returnRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: { order: { select: { id: true, orderNumber: true, customerName: true } }, _count: { select: { items: true } } },
    }),
    prisma.returnRequest.count({ where }),
  ]);
  return (
    <>
      <AdminPageHeader title="Returns" description="Review requests on the order page: approve, receive (restocks), refund, then close." />
      <FilterBar action="/admin/returns" resetHref="/admin/returns">
        <FilterField label="Status" htmlFor="status">
          <select id="status" name="status" defaultValue={status ?? ""} className={filterInput}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {RETURN_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <Th>Return</Th>
            <Th>Order</Th>
            <Th>Customer</Th>
            <Th>Reason</Th>
            <Th>Requested</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r) => (
              <tr key={r.id} className="hover:bg-ivory/40">
                <Td className="font-mono text-sm">{r.returnNumber}</Td>
                <Td>
                  <Link href={`/admin/orders/${r.order.id}`} className="font-mono text-sm hover:underline">
                    {r.order.orderNumber}
                  </Link>
                </Td>
                <Td>{r.order.customerName}</Td>
                <Td className="max-w-xs truncate text-charcoal">{r.reason}</Td>
                <Td className="text-xs text-muted">{r.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: settings.general.timeZone })}</Td>
                <Td>
                  <Badge tone={r.status === "REQUESTED" ? "warning" : r.status === "REJECTED" ? "danger" : r.status === "APPROVED" ? "info" : "success"}>{RETURN_STATUS_LABELS[r.status]}</Badge>
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={6}>No return requests.</EmptyRow>
          )}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} basePath="/admin/returns" searchParams={params} />
    </>
  );
}
