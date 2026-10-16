import type { InventoryMovementType } from "@prisma/client";
import Link from "next/link";
import { AdminPageHeader, EmptyRow, FilterBar, FilterField, filterInput, Table, Td, Th } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/pagination";
import { ADMIN_PAGE_SIZE, MOVEMENT_TYPE_LABELS } from "@/lib/constants";
import { cn, firstParam, parsePositiveInt } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { listMovements } from "@/server/services/inventory";

export const metadata = { title: "Stock movements" };

const TYPES = Object.keys(MOVEMENT_TYPE_LABELS) as InventoryMovementType[];

export default async function MovementsPage({ searchParams }: PageProps<"/admin/inventory/movements">) {
  await requireStaffPage("inventory:read", "/admin/inventory/movements");
  const params = await searchParams;
  const type = firstParam(params.type) as InventoryMovementType | undefined;
  const page = parsePositiveInt(params.page, 1, 1000);
  const [settings, { rows, total }] = await Promise.all([
    getSettings(),
    listMovements(prisma, {
      type: type && TYPES.includes(type) ? type : undefined,
      variantId: firstParam(params.variant) || undefined,
      page,
      pageSize: ADMIN_PAGE_SIZE,
    }),
  ]);
  const tz = settings.general.timeZone;

  return (
    <>
      <AdminPageHeader title="Stock movement history" back={{ href: "/admin/inventory", label: "Inventory" }} description="Every stock change with its reason, reference and the person who made it." />
      <FilterBar action="/admin/inventory/movements" resetHref="/admin/inventory/movements">
        <FilterField label="Type" htmlFor="type">
          <select id="type" name="type" defaultValue={type ?? ""} className={filterInput}>
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {MOVEMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Item</Th>
            <Th>Type</Th>
            <Th align="right">Change</Th>
            <Th align="right">Before → after</Th>
            <Th>Reference / reason</Th>
            <Th>By</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((m) => (
              <tr key={m.id}>
                <Td className="whitespace-nowrap text-xs text-muted">
                  {m.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: tz })}
                </Td>
                <Td>
                  <span className="block font-medium">{m.productName}</span>
                  <span className="font-mono text-xs text-muted">{m.sku}</span>
                </Td>
                <Td>{MOVEMENT_TYPE_LABELS[m.type]}</Td>
                <Td align="right" className={cn("font-semibold", m.quantityChange > 0 ? "text-success" : "text-danger")}>
                  {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                </Td>
                <Td align="right" className="text-muted">
                  {m.quantityBefore} → {m.quantityAfter}
                </Td>
                <Td className="text-xs">
                  {m.order ? (
                    <Link href={`/admin/orders/${m.order.id}`} className="font-mono hover:underline">
                      {m.order.orderNumber}
                    </Link>
                  ) : null}
                  {m.returnRequest ? <span className="ml-2 font-mono">{m.returnRequest.returnNumber}</span> : null}
                  {m.reason ? <span className="block text-muted">{m.reason}</span> : null}
                </Td>
                <Td className="text-xs">{m.actor?.name ?? (m.type === "ORDER_PLACED" ? "Customer" : "System")}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={7}>No movements recorded.</EmptyRow>
          )}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} basePath="/admin/inventory/movements" searchParams={params} />
    </>
  );
}
