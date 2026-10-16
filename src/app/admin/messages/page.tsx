import type { ContactMessageStatus } from "@prisma/client";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPageHeader, FilterBar, FilterField, filterInput } from "@/components/admin/ui";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { firstParam, parsePositiveInt } from "@/lib/utils";
import { messageStatusAction } from "@/server/actions/admin/store";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { listContactMessages } from "@/server/services/contact";

export const metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  await requireStaffPage("messages:read", "/admin/messages");
  const params = await searchParams;
  const status = firstParam(params.status) as ContactMessageStatus | undefined;
  const page = parsePositiveInt(params.page, 1, 1000);
  const [settings, { rows, total }] = await Promise.all([
    getSettings(),
    listContactMessages(prisma, { status: status && ["NEW", "READ", "ARCHIVED"].includes(status) ? status : undefined, page, pageSize: ADMIN_PAGE_SIZE }),
  ]);
  return (
    <>
      <AdminPageHeader title="Contact messages" description="Messages sent through the Contact page." />
      <FilterBar action="/admin/messages" resetHref="/admin/messages">
        <FilterField label="Status" htmlFor="status">
          <select id="status" name="status" defaultValue={status ?? ""} className={filterInput}>
            <option value="">Inbox (new & read)</option>
            <option value="NEW">New</option>
            <option value="READ">Read</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </FilterField>
      </FilterBar>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((m) => (
            <li key={m.id} className="rounded-xl border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {m.subject} {m.status === "NEW" ? <Badge tone="warning">New</Badge> : null}
                  </p>
                  <p className="text-sm text-muted">
                    {m.name} ·{" "}
                    <a href={`mailto:${m.email}`} className="hover:underline">
                      {m.email}
                    </a>
                    {m.phone ? ` · ${m.phone}` : ""} · {m.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: settings.general.timeZone })}
                  </p>
                </div>
                <div className="flex gap-2">
                  {m.status === "NEW" ? (
                    <ActionButton action={messageStatusAction} fields={{ id: m.id, status: "READ" }}>
                      Mark read
                    </ActionButton>
                  ) : null}
                  {m.status !== "ARCHIVED" ? (
                    <ActionButton action={messageStatusAction} fields={{ id: m.id, status: "ARCHIVED" }} variant="ghost">
                      Archive
                    </ActionButton>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-charcoal">{m.message}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No messages" />
      )}
      <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} basePath="/admin/messages" searchParams={params} />
    </>
  );
}
