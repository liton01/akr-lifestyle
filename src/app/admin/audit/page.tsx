import { AdminPageHeader, EmptyRow, FilterBar, FilterField, filterInput, Table, Td, Th } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/pagination";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { firstParam, parsePositiveInt } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireStaffPage("audit:view", "/admin/audit");
  const params = await searchParams;
  const page = parsePositiveInt(params.page, 1, 1000);
  const action = firstParam(params.action)?.trim();
  const entity = firstParam(params.entity)?.trim();
  const where = {
    ...(action ? { action: { startsWith: action } } : {}),
    ...(entity ? { entityType: entity } : {}),
  };
  const [settings, rows, total, entityTypes] = await Promise.all([
    getSettings(),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  return (
    <>
      <AdminPageHeader title="Audit log" description="Sensitive administrative operations, newest first." />
      <FilterBar action="/admin/audit" resetHref="/admin/audit">
        <FilterField label="Action starts with" htmlFor="action">
          <input id="action" name="action" defaultValue={action ?? ""} placeholder="e.g. order., product.update" className={`${filterInput} w-56`} />
        </FilterField>
        <FilterField label="Entity" htmlFor="entity">
          <select id="entity" name="entity" defaultValue={entity ?? ""} className={filterInput}>
            <option value="">All</option>
            {entityTypes.map((e) => (
              <option key={e.entityType} value={e.entityType}>
                {e.entityType}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Who</Th>
            <Th>Action</Th>
            <Th>Entity</Th>
            <Th>Details</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((log) => (
              <tr key={log.id} className="align-top">
                <Td className="whitespace-nowrap text-xs text-muted">{log.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: settings.general.timeZone })}</Td>
                <Td className="text-xs">{log.actorEmail ?? "System"}</Td>
                <Td className="font-mono text-xs">{log.action}</Td>
                <Td className="text-xs">
                  {log.entityType}
                  {log.entityId ? <span className="block font-mono text-muted">{log.entityId}</span> : null}
                </Td>
                <Td>
                  {log.metadata ? (
                    <pre className="max-h-32 max-w-md overflow-auto whitespace-pre-wrap break-all rounded bg-ivory/60 p-2 text-[11px] leading-4">{JSON.stringify(log.metadata, null, 1)}</pre>
                  ) : null}
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={5}>No audit entries.</EmptyRow>
          )}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} basePath="/admin/audit" searchParams={params} />
    </>
  );
}
