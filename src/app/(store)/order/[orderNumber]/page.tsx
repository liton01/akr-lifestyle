import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/store/catalog";
import {
  AddressBlock,
  formatDateTime,
  OrderItemsList,
  OrderStatusBadge,
  OrderTimeline,
  OrderTotals,
  PaymentSummary,
} from "@/components/store/order-view";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/client";
import { firstParam } from "@/lib/utils";
import { payOrderAction } from "@/server/actions/checkout";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { isSslcommerzConfigured } from "@/server/env";
import { verifyOrderAccessToken } from "@/server/services/order-access";
import { getOrderByNumber } from "@/server/services/orders";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default async function OrderReceiptPage({ params, searchParams }: PageProps<"/order/[orderNumber]">) {
  const { orderNumber } = await params;
  const query = await searchParams;
  const token = firstParam(query.token) ?? "";
  const order = await getOrderByNumber(prisma, decodeURIComponent(orderNumber));
  if (!order) notFound();
  const user = await getCurrentUser();
  const authorised = verifyOrderAccessToken(order.id, token) || (user !== null && order.userId === user.id);
  if (!authorised) notFound();

  const settings = await getSettings();
  const tz = settings.general.timeZone;
  const justPlaced = firstParam(query.placed) === "1";
  const payment = firstParam(query.payment);
  const canPay =
    order.paymentMethod === "SSLCOMMERZ" &&
    order.status === "PENDING" &&
    order.paymentStatus !== "PAID" &&
    (!order.paymentDueBy || order.paymentDueBy > new Date()) &&
    isSslcommerzConfigured();

  return (
    <div className="container-page max-w-4xl py-8 lg:py-12">
      {justPlaced || payment === "success" ? (
        <div className="mb-8 rounded-[var(--radius-card)] bg-ink p-8 text-center text-ivory">
          <CheckCircle2 className="mx-auto h-12 w-12 text-gold" aria-hidden="true" />
          <h1 className="mt-4 text-4xl font-semibold">Thank you for your order!</h1>
          <p className="mt-2 text-ivory/75">
            Order <strong className="text-gold">{order.orderNumber}</strong> has been received.
            {order.customerEmail ? " A confirmation has been sent to your email." : ""}
          </p>
        </div>
      ) : (
        <PageHeader title={`Order ${order.orderNumber}`} description={`Placed ${formatDateTime(order.createdAt, tz)}`} />
      )}

      {payment === "success" && order.paymentStatus !== "PAID" ? (
        <Alert tone="info" className="mb-6" title="We are confirming your payment">
          Your payment is being verified with the payment provider. This page will show “Paid” once it is confirmed.
        </Alert>
      ) : null}
      {payment === "failed" || payment === "cancelled" ? (
        <Alert tone="danger" className="mb-6" title={payment === "failed" ? "Payment failed" : "Payment cancelled"}>
          Your order is saved. You can try paying again below before the payment window closes.
        </Alert>
      ) : null}
      {payment === "error" ? (
        <Alert tone="warning" className="mb-6" title="We could not start the online payment">
          Your order is saved. Please try again, or contact us to switch to cash on delivery.
        </Alert>
      ) : null}

      <div className="card space-y-8 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Order number</p>
            <p className="font-mono text-lg font-semibold">{order.orderNumber}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <OrderTimeline status={order.status} history={order.statusHistory} timeZone={tz} />

        {canPay ? (
          <form action={payOrderAction} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gold/10 p-4">
            <input type="hidden" name="orderNumber" value={order.orderNumber} />
            <input type="hidden" name="token" value={token} />
            <p className="text-sm">
              Payment pending.
              {order.paymentDueBy ? ` Please complete payment before ${formatDateTime(order.paymentDueBy, tz)}.` : ""}
            </p>
            <SubmitButton variant="gold" pendingText="Redirecting…">
              Pay now
            </SubmitButton>
          </form>
        ) : null}

        <section aria-labelledby="items-heading">
          <h2 id="items-heading" className="text-2xl font-semibold">
            Items
          </h2>
          <OrderItemsList items={order.items} />
        </section>

        <div className="grid gap-8 border-t border-line pt-6 sm:grid-cols-3">
          <AddressBlock title="Delivery address" address={order.shippingAddress} />
          <PaymentSummary method={order.paymentMethod} status={order.paymentStatus} />
          <OrderTotals order={order} />
        </div>

        {order.trackingNumber ? (
          <p className="text-sm text-charcoal">
            Courier: {order.courierName ?? "—"} · Tracking number <span className="font-mono">{order.trackingNumber}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/shop" variant="outline">
          Continue shopping
        </ButtonLink>
        {user ? (
          <ButtonLink href={`/account/orders/${order.orderNumber}`} variant="ghost">
            View in my account
          </ButtonLink>
        ) : (
          <ButtonLink href="/track-order" variant="ghost">
            Track this order later
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
