import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelOrderForm, ReturnRequestForm } from "@/components/account/account-forms";
import {
  AddressBlock,
  formatDateTime,
  OrderItemsList,
  OrderStatusBadge,
  OrderTimeline,
  OrderTotals,
  PaymentSummary,
} from "@/components/store/order-view";
import { Badge } from "@/components/ui/feedback";
import { RETURN_STATUS_LABELS } from "@/lib/constants";
import { canCustomerCancel } from "@/lib/order-status";
import { requireUserPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { orderReceiptPath } from "@/server/services/order-access";
import { getCustomerOrder } from "@/server/services/orders";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

export default async function AccountOrderPage({ params }: PageProps<"/account/orders/[orderNumber]">) {
  const { orderNumber } = await params;
  const user = await requireUserPage(`/account/orders/${orderNumber}`);
  const [order, settings] = await Promise.all([getCustomerOrder(prisma, user.id, decodeURIComponent(orderNumber)), getSettings()]);
  if (!order) notFound();
  const tz = settings.general.timeZone;

  const pendingReturn = new Map<string, number>();
  for (const request of order.returnRequests) {
    if (request.status === "REQUESTED" || request.status === "APPROVED") {
      for (const item of request.items) pendingReturn.set(item.orderItemId, (pendingReturn.get(item.orderItemId) ?? 0) + item.quantity);
    }
  }
  const windowEnds = order.deliveredAt ? new Date(order.deliveredAt.getTime() + settings.commerce.returnWindowDays * 86_400_000) : null;
  const returnable = order.items
    .map((i) => ({ id: i.id, name: i.productName, variant: i.variantName, returnable: i.quantity - i.returnedQuantity - (pendingReturn.get(i.id) ?? 0) }))
    .filter((i) => i.returnable > 0);
  const canReturn = order.status === "DELIVERED" && windowEnds !== null && windowEnds > new Date() && returnable.length > 0;

  return (
    <div className="space-y-6">
      <Link href="/account/orders" className="text-sm link">
        ← All orders
      </Link>
      <div className="card space-y-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-xl font-semibold">{order.orderNumber}</h2>
            <p className="text-sm text-muted">Placed {formatDateTime(order.createdAt, tz)}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <OrderTimeline status={order.status} history={order.statusHistory} timeZone={tz} />
        {order.paymentMethod === "SSLCOMMERZ" && order.paymentStatus !== "PAID" && order.status === "PENDING" ? (
          <p className="rounded-md bg-gold/10 p-3 text-sm">
            Payment pending —{" "}
            <Link href={orderReceiptPath(order.orderNumber, order.id)} className="link">
              complete your payment
            </Link>
            .
          </p>
        ) : null}
        <OrderItemsList items={order.items} />
        <div className="grid gap-8 border-t border-line pt-6 sm:grid-cols-3">
          <AddressBlock title="Delivery address" address={order.shippingAddress} />
          <PaymentSummary method={order.paymentMethod} status={order.paymentStatus} />
          <OrderTotals order={order} />
        </div>
        {order.trackingNumber ? (
          <p className="text-sm">
            Courier: {order.courierName ?? "—"} · Tracking <span className="font-mono">{order.trackingNumber}</span>
          </p>
        ) : null}
      </div>

      {order.returnRequests.length ? (
        <section className="card p-6" aria-labelledby="returns-heading">
          <h3 id="returns-heading" className="text-xl font-semibold">
            Return requests
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            {order.returnRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2">
                <span className="font-mono">{r.returnNumber}</span>
                <span className="text-muted">{formatDateTime(r.createdAt, tz)}</span>
                <Badge tone={r.status === "REJECTED" ? "danger" : r.status === "CLOSED" || r.status === "RECEIVED" ? "success" : "info"}>
                  {RETURN_STATUS_LABELS[r.status]}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canCustomerCancel(order.status) ? (
        <section className="card p-6" aria-labelledby="cancel-heading">
          <h3 id="cancel-heading" className="text-xl font-semibold">
            Cancel order
          </h3>
          <p className="mt-1 text-sm text-muted">You can cancel while the order is pending or confirmed.</p>
          <div className="mt-4">
            <CancelOrderForm orderId={order.id} />
          </div>
        </section>
      ) : null}

      {canReturn ? (
        <section className="card p-6" aria-labelledby="return-heading">
          <h3 id="return-heading" className="text-xl font-semibold">
            Request a return
          </h3>
          <p className="mt-1 text-sm text-muted">Available until {windowEnds!.toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: tz })}.</p>
          <div className="mt-4">
            <ReturnRequestForm orderId={order.id} items={returnable} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
