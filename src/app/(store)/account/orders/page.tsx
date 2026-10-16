import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatDateTime, OrderStatusBadge, PaymentStatusBadge } from "@/components/store/order-view";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { formatBDT, toMinor } from "@/lib/money";
import { parsePositiveInt } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { listOwnOrders } from "@/server/services/customers";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

const PAGE_SIZE = 10;

export default async function OrdersPage({ searchParams }: PageProps<"/account/orders">) {
  const user = await requireUserPage("/account/orders");
  const params = await searchParams;
  const page = parsePositiveInt(params.page, 1, 1000);
  const [{ rows, total }, settings] = await Promise.all([listOwnOrders(prisma, user.id, page, PAGE_SIZE), getSettings()]);
  return (
    <div>
      <h2 className="text-2xl font-semibold">Order history</h2>
      {rows.length ? (
        <ul className="mt-6 space-y-4">
          {rows.map((order) => (
            <li key={order.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/account/orders/${order.orderNumber}`} className="font-mono text-sm font-semibold hover:underline">
                    {order.orderNumber}
                  </Link>
                  <p className="text-xs text-muted">{formatDateTime(order.createdAt, settings.general.timeZone)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <OrderStatusBadge status={order.status} />
                  <PaymentStatusBadge status={order.paymentStatus} />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="flex -space-x-2">
                  {order.items.map((item, index) =>
                    item.imageUrl ? (
                      <Image key={index} src={item.imageUrl} alt="" width={48} height={48} className="h-12 w-12 rounded-full border-2 border-white bg-ivory object-cover" />
                    ) : null,
                  )}
                  {order._count.items > 3 ? (
                    <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-ivory text-xs">+{order._count.items - 3}</span>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatBDT(toMinor(order.total))}</p>
                  <Link href={`/account/orders/${order.orderNumber}`} className="text-sm link">
                    View details
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-6" title="No orders yet" action={<ButtonLink href="/shop">Start shopping</ButtonLink>} />
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/account/orders" searchParams={params} />
    </div>
  );
}
