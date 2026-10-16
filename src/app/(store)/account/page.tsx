import type { Metadata } from "next";
import Link from "next/link";
import { ResendVerificationButton } from "@/components/account/account-forms";
import { formatDateTime, OrderStatusBadge } from "@/components/store/order-view";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { formatBDT, toMinor } from "@/lib/money";
import { firstParam } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { listOwnOrders } from "@/server/services/customers";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const user = await requireUserPage("/account");
  const params = await searchParams;
  const [{ rows, total }, addressCount, settings] = await Promise.all([
    listOwnOrders(prisma, user.id, 1, 5),
    prisma.address.count({ where: { userId: user.id } }),
    getSettings(),
  ]);
  return (
    <div className="space-y-8">
      {firstParam(params.welcome) ? <Alert tone="success">Welcome to AKR Lifestyle! Your account is ready.</Alert> : null}
      {firstParam(params.verified) ? <Alert tone="success">Thank you — your email address has been verified.</Alert> : null}
      {!user.emailVerified ? (
        <Alert tone="info" title="Please verify your email address">
          <p>We sent a verification link to {user.email}.</p>
          <ResendVerificationButton />
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-muted">Email</p>
          <p className="mt-1 truncate font-medium">{user.email}</p>
        </div>
        <Link href="/account/addresses" className="card p-5 hover:border-gold">
          <p className="text-sm text-muted">Saved addresses</p>
          <p className="mt-1 text-2xl font-semibold">{addressCount}</p>
        </Link>
        <Link href="/account/orders" className="card p-5 hover:border-gold">
          <p className="text-sm text-muted">Orders</p>
          <p className="mt-1 text-2xl font-semibold">{total}</p>
        </Link>
      </div>

      <section aria-labelledby="recent-orders">
        <div className="flex items-center justify-between">
          <h2 id="recent-orders" className="text-2xl font-semibold">
            Recent orders
          </h2>
          {rows.length ? (
            <Link href="/account/orders" className="text-sm link">
              View all
            </Link>
          ) : null}
        </div>
        {rows.length ? (
          <ul className="mt-4 divide-y divide-line rounded-[var(--radius-card)] border border-line">
            {rows.map((order) => (
              <li key={order.id}>
                <Link href={`/account/orders/${order.orderNumber}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-ivory/50">
                  <div>
                    <p className="font-mono text-sm font-semibold">{order.orderNumber}</p>
                    <p className="text-xs text-muted">{formatDateTime(order.createdAt, settings.general.timeZone)}</p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                  <p className="text-sm font-medium tabular-nums">{formatBDT(toMinor(order.total))}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="mt-4" title="No orders yet" description="When you place an order it will appear here." action={<ButtonLink href="/shop">Start shopping</ButtonLink>} />
        )}
      </section>
    </div>
  );
}
