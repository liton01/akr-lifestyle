import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { CustomerNoteForm } from "@/components/admin/simple-forms";
import { AdminPageHeader, DefinitionList, Panel } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/store/order-view";
import { Badge } from "@/components/ui/feedback";
import { formatBDT, toMinor } from "@/lib/money";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { setUserActiveAction } from "@/server/actions/admin/store";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { getCustomerDetail } from "@/server/services/customers";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  const user = await requireStaffPage("customer:read", `/admin/customers/${id}`);
  const [customer, settings] = await Promise.all([getCustomerDetail(prisma, id), getSettings()]);
  if (!customer) notFound();
  const tz = settings.general.timeZone;
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: tz });
  const canManage = can(user.role, "customer:manage") && customer.id !== user.id;

  return (
    <>
      <AdminPageHeader
        title={customer.name}
        description={customer.email}
        back={{ href: "/admin/customers", label: "Customers" }}
        actions={
          canManage ? (
            <ActionButton
              action={setUserActiveAction}
              fields={{ id: customer.id, active: customer.isActive ? "false" : "true" }}
              variant={customer.isActive ? "danger" : "primary"}
              confirm={
                customer.isActive
                  ? { title: "Deactivate this account?", description: "The customer will be signed out and unable to sign in. Order history is kept.", confirmLabel: "Deactivate" }
                  : undefined
              }
            >
              {customer.isActive ? "Deactivate account" : "Activate account"}
            </ActionButton>
          ) : null
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Recent orders">
            {customer.orders.length ? (
              <ul className="divide-y divide-line text-sm">
                {customer.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono hover:underline">
                      {o.orderNumber}
                    </Link>
                    <span className="text-xs text-muted">{fmt(o.createdAt)}</span>
                    <OrderStatusBadge status={o.status} />
                    <span className="font-medium">{formatBDT(toMinor(o.total))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No orders yet.</p>
            )}
          </Panel>
          <Panel title="Addresses">
            {customer.addresses.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {customer.addresses.map((a) => (
                  <li key={a.id} className="rounded-lg border border-line p-3 text-sm">
                    <p className="font-medium">
                      {a.label || "Address"} {a.isDefault ? <Badge tone="gold">Default</Badge> : null}
                    </p>
                    <p className="mt-1 text-charcoal">
                      {a.fullName}, {a.phone}
                      <br />
                      {a.addressLine}, {a.area}, {a.district}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No saved addresses.</p>
            )}
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Profile">
            <DefinitionList
              items={[
                { label: "Status", value: customer.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Deactivated</Badge> },
                { label: "Role", value: ROLE_LABELS[customer.role] },
                { label: "Email verified", value: customer.emailVerified ? "Yes" : "No" },
                { label: "Phone", value: customer.profile?.phone ?? "—" },
                { label: "Joined", value: fmt(customer.createdAt) },
                { label: "Last sign-in", value: customer.lastLoginAt ? fmt(customer.lastLoginAt) : "—" },
                { label: "Orders (non-cancelled)", value: customer.orderCount },
                { label: "Lifetime value", value: formatBDT(customer.lifetimeValue ? toMinor(customer.lifetimeValue) : 0) },
                { label: "Marketing opt-in", value: customer.profile?.marketingOptIn ? "Yes" : "No" },
              ]}
            />
          </Panel>
          {can(user.role, "customer:manage") ? (
            <Panel title="Internal note">
              <CustomerNoteForm id={customer.id} note={customer.profile?.adminNote ?? ""} />
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
