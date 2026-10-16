import Link from "next/link";
import { AdminPageHeader, EmptyRow, FilterBar, FilterField, filterInput, Table, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { firstParam, parsePositiveInt } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { listCustomers } from "@/server/services/customers";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireStaffPage("customer:read", "/admin/customers");
  const params = await searchParams;
  const status = firstParam(params.status) as "active" | "inactive" | undefined;
  const page = parsePositiveInt(params.page, 1, 1000);
  const [settings, { rows, total }] = await Promise.all([
    getSettings(),
    listCustomers(prisma, { q: firstParam(params.q)?.trim() || undefined, status: status === "active" || status === "inactive" ? status : undefined, page, pageSize: ADMIN_PAGE_SIZE }),
  ]);
  return (
    <>
      <AdminPageHeader title="Customers" description={`${total} registered customer${total === 1 ? "" : "s"}. Guest orders are listed under Orders.`} />
      <FilterBar action="/admin/customers" resetHref="/admin/customers">
        <FilterField label="Search" htmlFor="q">
          <input id="q" name="q" defaultValue={firstParam(params.q) ?? ""} placeholder="Name, email or phone" className={`${filterInput} w-64`} />
        </FilterField>
        <FilterField label="Status" htmlFor="status">
          <select id="status" name="status" defaultValue={status ?? ""} className={filterInput}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </select>
        </FilterField>
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <Th>Customer</Th>
            <Th>Phone</Th>
            <Th align="right">Orders</Th>
            <Th>Joined</Th>
            <Th>Last sign-in</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((c) => (
              <tr key={c.id} className="hover:bg-ivory/40">
                <Td>
                  <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  <span className="block text-xs text-muted">
                    {c.email}
                    {c.emailVerified ? " · verified" : ""}
                  </span>
                </Td>
                <Td>{c.profile?.phone ?? "—"}</Td>
                <Td align="right">{c._count.orders}</Td>
                <Td className="text-xs text-muted">{c.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: settings.general.timeZone })}</Td>
                <Td className="text-xs text-muted">{c.lastLoginAt ? c.lastLoginAt.toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: settings.general.timeZone }) : "—"}</Td>
                <Td>{c.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Deactivated</Badge>}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={6}>No customers found.</EmptyRow>
          )}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} basePath="/admin/customers" searchParams={params} />
    </>
  );
}
