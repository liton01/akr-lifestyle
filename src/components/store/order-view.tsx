import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { Check, Circle, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/feedback";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { formatBDT, toMinor, type DecimalLike } from "@/lib/money";
import { TRACKING_STEPS, trackingStepIndex } from "@/lib/order-status";
import { cn } from "@/lib/utils";

export function orderStatusTone(status: OrderStatus) {
  return status === "DELIVERED" ? "success" : status === "CANCELLED" || status === "RETURNED" ? "danger" : status === "PENDING" ? "warning" : "info";
}

export function paymentStatusTone(status: PaymentStatus) {
  return status === "PAID" ? "success" : status === "FAILED" ? "danger" : status === "PENDING" ? "warning" : "neutral";
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={orderStatusTone(status)}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={paymentStatusTone(status)}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function formatDateTime(date: Date, timeZone: string) {
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone });
}

export function OrderTimeline({
  status,
  history,
  timeZone,
}: {
  status: OrderStatus;
  history: { toStatus: OrderStatus; createdAt: Date }[];
  timeZone: string;
}) {
  if (status === "CANCELLED" || status === "RETURNED") {
    const event = [...history].reverse().find((h) => h.toStatus === status);
    return (
      <div className="flex items-center gap-3 rounded-lg bg-danger/5 p-4 text-sm text-danger">
        <X className="h-5 w-5" aria-hidden="true" />
        <span>
          This order was {status === "CANCELLED" ? "cancelled" : "returned"}
          {event ? ` on ${formatDateTime(event.createdAt, timeZone)}` : ""}.
        </span>
      </div>
    );
  }
  const current = trackingStepIndex(status);
  return (
    <ol className="grid grid-cols-3 gap-y-4 sm:grid-cols-6" aria-label="Order progress">
      {TRACKING_STEPS.map((step, index) => {
        const done = index <= current;
        const when = history.find((h) => h.toStatus === step)?.createdAt;
        return (
          <li key={step} className="flex flex-col items-center text-center" aria-current={index === current ? "step" : undefined}>
            <span className={cn("grid h-8 w-8 place-items-center rounded-full border-2", done ? "border-ink bg-ink text-ivory" : "border-line text-muted")}>
              {done ? <Check className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-3 w-3" aria-hidden="true" />}
            </span>
            <span className={cn("mt-2 text-xs font-medium", done ? "text-ink" : "text-muted")}>{ORDER_STATUS_LABELS[step]}</span>
            {when ? <span className="text-[11px] text-muted">{when.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone })}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

type OrderItemView = {
  id: string;
  productName: string;
  productSlug: string | null;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  returnedQuantity: number;
  originalUnitPrice: DecimalLike;
  finalUnitPrice: DecimalLike;
  discountLabel: string | null;
  lineSubtotal: DecimalLike;
};

export function OrderItemsList({ items }: { items: OrderItemView[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const original = toMinor(item.originalUnitPrice);
        const final = toMinor(item.finalUnitPrice);
        return (
          <li key={item.id} className="flex gap-4 py-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-ivory">
              {item.imageUrl ? <Image src={item.imageUrl} alt="" width={64} height={64} className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              {item.productSlug ? (
                <Link href={`/product/${item.productSlug}`} className="font-medium hover:underline">
                  {item.productName}
                </Link>
              ) : (
                <p className="font-medium">{item.productName}</p>
              )}
              {item.variantName ? <p className="text-xs text-muted">{item.variantName}</p> : null}
              <p className="text-xs text-muted">
                SKU {item.sku} · Qty {item.quantity}
                {item.returnedQuantity ? ` · ${item.returnedQuantity} returned` : ""}
              </p>
              <p className="mt-1 text-xs">
                {formatBDT(final)} each
                {original > final ? <span className="ml-2 text-muted line-through">{formatBDT(original)}</span> : null}
                {item.discountLabel ? <span className="ml-2 text-gold-deep">{item.discountLabel}</span> : null}
              </p>
            </div>
            <p className="text-sm font-medium tabular-nums">{formatBDT(toMinor(item.lineSubtotal))}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function OrderTotals({
  order,
}: {
  order: {
    subtotal: DecimalLike;
    itemDiscountTotal: DecimalLike;
    couponDiscount: DecimalLike;
    couponCode: string | null;
    deliveryFee: DecimalLike;
    total: DecimalLike;
    refundedAmount: DecimalLike;
  };
}) {
  const rows: [string, number, boolean?][] = [["Subtotal", toMinor(order.subtotal)]];
  if (toMinor(order.itemDiscountTotal) > 0) rows.push(["Sale & promotion savings", -toMinor(order.itemDiscountTotal), true]);
  if (toMinor(order.couponDiscount) > 0) rows.push([`Coupon${order.couponCode ? ` (${order.couponCode})` : ""}`, -toMinor(order.couponDiscount), true]);
  rows.push(["Delivery", toMinor(order.deliveryFee)]);
  const refunded = toMinor(order.refundedAmount);
  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([label, value, success]) => (
        <div key={label} className="flex justify-between">
          <dt className="text-charcoal">{label}</dt>
          <dd className={cn("tabular-nums", success && "text-success")}>{value < 0 ? `-${formatBDT(-value)}` : formatBDT(value)}</dd>
        </div>
      ))}
      <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatBDT(toMinor(order.total))}</dd>
      </div>
      {refunded > 0 ? (
        <div className="flex justify-between text-sm text-danger">
          <dt>Refunded</dt>
          <dd className="tabular-nums">-{formatBDT(refunded)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function AddressBlock({ title, address }: { title: string; address: unknown }) {
  const a = (address ?? {}) as { fullName?: string; phone?: string; addressLine?: string; area?: string; district?: string; postalCode?: string | null };
  return (
    <div className="text-sm">
      <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted">{title}</h3>
      <address className="mt-2 not-italic leading-6 text-charcoal">
        {a.fullName ? <span className="block font-medium text-ink">{a.fullName}</span> : null}
        {a.phone ? <span className="block">{a.phone}</span> : null}
        {a.addressLine ? <span className="block">{a.addressLine}</span> : null}
        <span className="block">{[a.area, a.district, a.postalCode].filter(Boolean).join(", ")}</span>
      </address>
    </div>
  );
}

export function PaymentSummary({ method, status }: { method: keyof typeof PAYMENT_METHOD_LABELS; status: PaymentStatus }) {
  return (
    <div className="text-sm">
      <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted">Payment</h3>
      <p className="mt-2 text-charcoal">{PAYMENT_METHOD_LABELS[method]}</p>
      <div className="mt-1">
        <PaymentStatusBadge status={status} />
      </div>
    </div>
  );
}
