import { FileText, Package } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { AdminNoteForm, OrderStatusForm, ReceiveReturnForm, RefundForm, ShippingForm, StaffReturnForm } from "@/components/admin/order-forms";
import { AdminPageHeader, DefinitionList, Panel } from "@/components/admin/ui";
import { AddressBlock, OrderItemsList, OrderStatusBadge, OrderTotals, PaymentStatusBadge } from "@/components/store/order-view";
import { Alert, Badge } from "@/components/ui/feedback";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, REFUND_METHOD_LABELS, RETURN_STATUS_LABELS } from "@/lib/constants";
import { formatBDT, toMinor } from "@/lib/money";
import { STAFF_TRANSITIONS } from "@/lib/order-status";
import { can } from "@/lib/permissions";
import { closeReturnAction, markCodPaidAction, reviewReturnAction } from "@/server/actions/admin/orders";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { getAdminOrder } from "@/server/services/orders";

export const metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const user = await requireStaffPage("order:read", `/admin/orders/${id}`);
  const [order, settings] = await Promise.all([getAdminOrder(prisma, id), getSettings()]);
  if (!order) notFound();
  const tz = settings.general.timeZone;
  const fmt = (d: Date) => d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: tz });
  const canUpdate = can(user.role, "order:update");
  const canRefund = can(user.role, "order:refund");
  const paid = toMinor(order.paidAmount);
  const refunded = toMinor(order.refundedAmount);
  const refundable = paid - refunded;
  const allowed = [...STAFF_TRANSITIONS[order.status]];
  const pendingReturnQty = new Map<string, number>();
  for (const r of order.returnRequests) {
    if (r.status === "REQUESTED" || r.status === "APPROVED") for (const i of r.items) pendingReturnQty.set(i.orderItemId, (pendingReturnQty.get(i.orderItemId) ?? 0) + i.quantity);
  }
  const returnableItems = order.items
    .map((i) => ({ id: i.id, label: `${i.productName}${i.variantName ? ` (${i.variantName})` : ""}`, returnable: i.quantity - i.returnedQuantity - (pendingReturnQty.get(i.id) ?? 0) }))
    .filter((i) => i.returnable > 0);
  const itemLabel = (orderItemId: string) => {
    const item = order.items.find((i) => i.id === orderItemId);
    return item ? `${item.productName}${item.variantName ? ` (${item.variantName})` : ""}` : "Item";
  };

  return (
    <>
      <AdminPageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed ${fmt(order.createdAt)}`}
        back={{ href: "/admin/orders", label: "Orders" }}
        actions={
          <>
            <Link href={`/print/orders/${order.id}/invoice`} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-sm hover:bg-ivory">
              <FileText className="h-4 w-4" /> Invoice
            </Link>
            <Link href={`/print/orders/${order.id}/packing-slip`} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-sm hover:bg-ivory">
              <Package className="h-4 w-4" /> Packing slip
            </Link>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.paymentStatus} />
        <Badge>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</Badge>
        {order.couponCode ? <Badge tone="gold">Coupon {order.couponCode}</Badge> : null}
      </div>

      {order.status === "CANCELLED" && refundable > 0 ? (
        <Alert tone="warning" className="mb-6" title="Refund due">
          This order was cancelled after {formatBDT(paid)} was paid. Record the refund below once it has been sent.
        </Alert>
      ) : null}
      {order.paymentMethod === "SSLCOMMERZ" && order.status === "PENDING" && order.paymentStatus !== "PAID" && order.paymentDueBy ? (
        <Alert tone="info" className="mb-6">
          Awaiting online payment. Unpaid orders are cancelled automatically after {fmt(order.paymentDueBy)} and their stock is released.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Panel title="Items">
            <OrderItemsList items={order.items} />
            <div className="mt-4 border-t border-line pt-4 sm:ml-auto sm:max-w-xs">
              <OrderTotals order={order} />
            </div>
          </Panel>

          <Panel title="Customer & delivery">
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="text-sm">
                <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted">Customer</h3>
                <p className="mt-2 font-medium">{order.customerName}</p>
                <p>
                  <a href={`tel:${order.customerPhone}`} className="hover:underline">
                    {order.customerPhone}
                  </a>
                </p>
                {order.customerEmail ? <p className="break-all">{order.customerEmail}</p> : null}
                {order.user ? (
                  <Link href={`/admin/customers/${order.user.id}`} className="mt-1 inline-block text-xs link">
                    Customer account
                  </Link>
                ) : (
                  <p className="mt-1 text-xs text-muted">Guest checkout</p>
                )}
              </div>
              <AddressBlock title="Delivery address" address={order.shippingAddress} />
              {order.billingAddress ? <AddressBlock title="Billing address" address={order.billingAddress} /> : null}
            </div>
            <div className="mt-4 grid gap-2 border-t border-line pt-4 text-sm">
              <p>
                <span className="text-muted">Delivery zone:</span> {order.deliveryZoneName ?? "—"}
              </p>
              {order.deliveryInstructions ? (
                <p>
                  <span className="text-muted">Customer instructions:</span> {order.deliveryInstructions}
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel title="Payments">
            {order.payments.length ? (
              <ul className="divide-y divide-line text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-mono text-xs">{p.transactionId}</span>
                    <span>{formatBDT(toMinor(p.amount))}</span>
                    <Badge tone={p.status === "SUCCEEDED" ? "success" : p.status === "FAILED" ? "danger" : "neutral"}>{p.status.toLowerCase()}</Badge>
                    <span className="w-full text-xs text-muted">
                      {fmt(p.createdAt)}
                      {p.cardType ? ` · ${p.cardType}` : ""}
                      {p.bankTransactionId ? ` · bank ref ${p.bankTransactionId}` : ""}
                      {p.failureReason ? ` · ${p.failureReason}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No payments recorded yet.</p>
            )}
            {canUpdate && order.paymentMethod === "COD" && order.paymentStatus === "PENDING" && ["SHIPPED", "DELIVERED"].includes(order.status) ? (
              <div className="mt-4">
                <ActionButton action={markCodPaidAction} fields={{ orderId: order.id }} variant="primary" confirm={{ title: "Record cash collected?", description: `Marks ${formatBDT(toMinor(order.total))} as paid.` }}>
                  Mark cash collected
                </ActionButton>
              </div>
            ) : null}
          </Panel>

          <Panel title="Refunds">
            {order.refunds.length ? (
              <ul className="mb-4 divide-y divide-line text-sm">
                {order.refunds.map((r) => (
                  <li key={r.id} className="py-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{formatBDT(toMinor(r.amount))}</span>
                      <span>{REFUND_METHOD_LABELS[r.method]}</span>
                    </div>
                    <p className="text-xs text-muted">
                      {fmt(r.createdAt)} · {r.reason}
                      {r.reference ? ` · ref ${r.reference}` : ""}
                      {r.createdBy ? ` · by ${r.createdBy.name}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            {canRefund && refundable > 0 ? (
              <RefundForm orderId={order.id} refundable={refundable} returns={order.returnRequests.map((r) => ({ id: r.id, returnNumber: r.returnNumber }))} />
            ) : (
              <p className="text-sm text-muted">{paid > 0 ? "Fully refunded." : "Refunds can be recorded once a payment has been received."}</p>
            )}
          </Panel>

          <Panel title="Returns">
            {order.returnRequests.length ? (
              <ul className="space-y-4">
                {order.returnRequests.map((r) => (
                  <li key={r.id} className="rounded-lg border border-line p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-semibold">{r.returnNumber}</span>
                      <Badge tone={r.status === "REJECTED" ? "danger" : r.status === "RECEIVED" || r.status === "CLOSED" ? "success" : "info"}>{RETURN_STATUS_LABELS[r.status]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {fmt(r.createdAt)} · {r.reason}
                    </p>
                    <ul className="mt-2 list-disc pl-5">
                      {r.items.map((i) => (
                        <li key={i.id}>
                          {itemLabel(i.orderItemId)} × {i.quantity}
                          {r.restockedAt ? (i.restock ? " — restocked" : " — not restocked") : ""}
                        </li>
                      ))}
                    </ul>
                    {canUpdate ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.status === "REQUESTED" ? (
                          <ActionButton action={reviewReturnAction} fields={{ id: r.id, decision: "APPROVE" }} variant="primary">
                            Approve
                          </ActionButton>
                        ) : null}
                        {r.status === "REQUESTED" || r.status === "APPROVED" ? (
                          <ActionButton action={reviewReturnAction} fields={{ id: r.id, decision: "REJECT" }} variant="ghost" confirm={{ title: "Reject this return?" }}>
                            Reject
                          </ActionButton>
                        ) : null}
                        {r.status === "RECEIVED" ? (
                          <ActionButton action={closeReturnAction} fields={{ id: r.id }}>
                            Close
                          </ActionButton>
                        ) : null}
                      </div>
                    ) : null}
                    {canUpdate && r.status === "APPROVED" ? (
                      <div className="mt-3 border-t border-line pt-3">
                        <ReceiveReturnForm id={r.id} items={r.items.map((i) => ({ id: i.id, label: itemLabel(i.orderItemId), quantity: i.quantity }))} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No return requests.</p>
            )}
            {canUpdate && order.status === "DELIVERED" && returnableItems.length ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">Create a return on behalf of the customer</summary>
                <div className="mt-3">
                  <StaffReturnForm orderId={order.id} items={returnableItems} />
                </div>
              </details>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-6">
          {canUpdate ? (
            <Panel title="Update status">
              <OrderStatusForm
                orderId={order.id}
                current={order.status}
                allowed={allowed}
                courierName={order.courierName ?? ""}
                trackingNumber={order.trackingNumber ?? ""}
              />
            </Panel>
          ) : null}
          {canUpdate && ["PACKED", "SHIPPED", "DELIVERED"].includes(order.status) ? (
            <Panel title="Shipping">
              <ShippingForm orderId={order.id} courierName={order.courierName ?? ""} trackingNumber={order.trackingNumber ?? ""} />
            </Panel>
          ) : null}
          <Panel title="Summary">
            <DefinitionList
              items={[
                { label: "Order total", value: formatBDT(toMinor(order.total)) },
                { label: "Paid", value: formatBDT(paid) },
                { label: "Refunded", value: formatBDT(refunded) },
                { label: "Courier", value: order.courierName ?? "—" },
                { label: "Tracking", value: order.trackingNumber ?? "—" },
                { label: "Stock restored", value: order.stockRestoredAt ? fmt(order.stockRestoredAt) : "No" },
              ]}
            />
          </Panel>
          {canUpdate ? (
            <Panel title="Internal note">
              <AdminNoteForm orderId={order.id} note={order.adminNote ?? ""} />
            </Panel>
          ) : null}
          <Panel title="Status history">
            <ol className="space-y-3 text-sm">
              {order.statusHistory.map((h) => (
                <li key={h.id} className="border-l-2 border-gold pl-3">
                  <p className="font-medium">
                    {h.fromStatus && h.fromStatus !== h.toStatus ? `${ORDER_STATUS_LABELS[h.fromStatus]} → ` : ""}
                    {ORDER_STATUS_LABELS[h.toStatus]}
                  </p>
                  <p className="text-xs text-muted">
                    {fmt(h.createdAt)} · {h.actor?.name ?? (h.actorType === "CUSTOMER" ? "Customer" : h.actorType === "SYSTEM" ? "System" : "Staff")}
                  </p>
                  {h.note ? <p className="mt-0.5 text-xs">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Notifications">
            {order.notifications.length ? (
              <ul className="space-y-1 text-xs">
                {order.notifications.map((n) => (
                  <li key={n.id} className="flex justify-between gap-2">
                    <span>
                      {n.channel} · {n.template.toLowerCase().replace(/_/g, " ")}
                    </span>
                    <span className={n.status === "SENT" ? "text-success" : n.status === "FAILED" ? "text-danger" : "text-muted"}>{n.status.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">None.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
