import Link from "next/link";
import { AdminPageHeader, EmptyRow, Panel, Table, Td, Th } from "@/components/admin/ui";
import { Alert, Badge } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { parsePositiveInt } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { notificationStatus } from "@/server/notifications/providers";

export const metadata = { title: "Notification log" };

export default async function NotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  await requireStaffPage("audit:view", "/admin/notifications");
  const params = await searchParams;
  const page = parsePositiveInt(params.page, 1, 1000);
  const providers = notificationStatus();
  const [settings, rows, total] = await Promise.all([
    getSettings(),
    prisma.notificationLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE, include: { order: { select: { id: true, orderNumber: true } } } }),
    prisma.notificationLog.count(),
  ]);
  return (
    <>
      <AdminPageHeader title="Notification log" description="Outcome of every email and SMS attempt. Recipients are masked." />
      <Panel title="Providers" className="mb-6">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            Email: <strong>{providers.email.provider}</strong>{" "}
            {providers.email.delivers ? <Badge tone="success">Delivering</Badge> : <Badge tone="warning">Not delivering</Badge>}
          </p>
          <p>
            SMS: <strong>{providers.sms.provider}</strong> {providers.sms.delivers ? <Badge tone="success">Delivering</Badge> : <Badge tone="warning">Not configured</Badge>}
          </p>
        </div>
        {!providers.email.delivers || !providers.sms.delivers ? (
          <Alert tone="info" className="mt-4">
            Configure EMAIL_PROVIDER=smtp and/or SMS_PROVIDER=http in the server environment to deliver messages. Until then, attempts are logged as “skipped”.
          </Alert>
        ) : null}
      </Panel>
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Channel</Th>
            <Th>Template</Th>
            <Th>Recipient</Th>
            <Th>Order</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((n) => (
              <tr key={n.id}>
                <Td className="whitespace-nowrap text-xs text-muted">{n.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: settings.general.timeZone })}</Td>
                <Td>{n.channel}</Td>
                <Td className="text-xs">{n.template.toLowerCase().replace(/_/g, " ")}</Td>
                <Td className="font-mono text-xs">{n.recipientMasked}</Td>
                <Td>
                  {n.order ? (
                    <Link href={`/admin/orders/${n.order.id}`} className="font-mono text-xs hover:underline">
                      {n.order.orderNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  <Badge tone={n.status === "SENT" ? "success" : n.status === "FAILED" ? "danger" : "neutral"}>{n.status.toLowerCase()}</Badge>
                  {n.errorMessage ? <span className="mt-1 block max-w-xs text-xs text-muted">{n.errorMessage}</span> : null}
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={6}>No notifications yet.</EmptyRow>
          )}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} basePath="/admin/notifications" searchParams={params} />
    </>
  );
}
