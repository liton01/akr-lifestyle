import type { StoreSettings } from "@/lib/settings-schema";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { formatBDT, toMinor } from "@/lib/money";
import type { getAdminOrder } from "@/server/services/orders";

type Order = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

function Address({ title, value }: { title: string; value: unknown }) {
  const a = (value ?? {}) as { fullName?: string; phone?: string; addressLine?: string; area?: string; district?: string; postalCode?: string | null };
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
      <p className="mt-1 text-sm leading-6">
        <strong>{a.fullName}</strong>
        <br />
        {a.phone}
        <br />
        {a.addressLine}
        <br />
        {[a.area, a.district, a.postalCode].filter(Boolean).join(", ")}
      </p>
    </div>
  );
}

function Letterhead({ settings, title, order }: { settings: StoreSettings; title: string; order: Order }) {
  return (
    <div className="flex items-start justify-between border-b-2 border-ink pb-4">
      <div>
        <p className="font-display text-2xl font-bold">{settings.general.storeName}</p>
        <p className="text-xs text-muted">{settings.general.businessAddress}</p>
        <p className="text-xs text-muted">
          {settings.general.contactPhone} · {settings.general.contactEmail}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xl font-semibold uppercase tracking-widest">{title}</p>
        <p className="font-mono text-sm">{order.orderNumber}</p>
        <p className="text-xs text-muted">{order.createdAt.toLocaleDateString("en-GB", { dateStyle: "long", timeZone: settings.general.timeZone })}</p>
      </div>
    </div>
  );
}

export function InvoiceDocument({ order, settings }: { order: Order; settings: StoreSettings }) {
  const rows: [string, number][] = [["Subtotal", toMinor(order.subtotal)]];
  if (toMinor(order.itemDiscountTotal)) rows.push(["Discounts", -toMinor(order.itemDiscountTotal)]);
  if (toMinor(order.couponDiscount)) rows.push([`Coupon ${order.couponCode ?? ""}`.trim(), -toMinor(order.couponDiscount)]);
  rows.push(["Delivery", toMinor(order.deliveryFee)]);
  return (
    <article className="text-ink">
      <Letterhead settings={settings} title="Invoice" order={order} />
      <div className="mt-6 grid grid-cols-2 gap-6">
        <Address title="Bill to" value={order.billingAddress ?? order.shippingAddress} />
        <Address title="Ship to" value={order.shippingAddress} />
      </div>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-ink text-left text-xs uppercase tracking-wider">
            <th className="py-2">Item</th>
            <th className="py-2">SKU</th>
            <th className="py-2 text-right">Unit price</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-line">
              <td className="py-2">
                {item.productName}
                {item.variantName ? <span className="block text-xs text-muted">{item.variantName}</span> : null}
              </td>
              <td className="py-2 font-mono text-xs">{item.sku}</td>
              <td className="py-2 text-right">
                {formatBDT(toMinor(item.finalUnitPrice))}
                {toMinor(item.discountPerUnit) > 0 ? <span className="block text-xs text-muted line-through">{formatBDT(toMinor(item.originalUnitPrice))}</span> : null}
              </td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">{formatBDT(toMinor(item.lineSubtotal))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 ml-auto w-64 space-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span>{label}</span>
            <span>{value < 0 ? `-${formatBDT(-value)}` : formatBDT(value)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t-2 border-ink pt-1 text-base font-bold">
          <span>Total (BDT)</span>
          <span>{formatBDT(toMinor(order.total))}</span>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Payment</p>
          <p className="mt-1">
            {PAYMENT_METHOD_LABELS[order.paymentMethod]} — {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </p>
        </div>
        <p className="self-end text-right text-xs text-muted">Thank you for shopping with {settings.general.storeName}.</p>
      </div>
    </article>
  );
}

export function PackingSlipDocument({ order, settings }: { order: Order; settings: StoreSettings }) {
  return (
    <article className="text-ink">
      <Letterhead settings={settings} title="Packing slip" order={order} />
      <div className="mt-6 grid grid-cols-2 gap-6">
        <Address title="Ship to" value={order.shippingAddress} />
        <div className="text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Delivery</p>
          <p className="mt-1">{order.deliveryZoneName ?? "—"}</p>
          {order.courierName ? <p>Courier: {order.courierName}</p> : null}
          {order.trackingNumber ? <p className="font-mono">Tracking: {order.trackingNumber}</p> : null}
          <p className="mt-2 font-semibold">
            {order.paymentMethod === "COD" && order.paymentStatus !== "PAID" ? `Collect cash: ${formatBDT(toMinor(order.total))}` : "Prepaid — do not collect cash"}
          </p>
        </div>
      </div>
      {order.deliveryInstructions ? (
        <p className="mt-4 rounded border border-ink p-3 text-sm">
          <strong>Instructions:</strong> {order.deliveryInstructions}
        </p>
      ) : null}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-ink text-left text-xs uppercase tracking-wider">
            <th className="py-2">✓</th>
            <th className="py-2">Item</th>
            <th className="py-2">SKU</th>
            <th className="py-2 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-line">
              <td className="py-3">
                <span className="inline-block h-4 w-4 border border-ink" aria-hidden="true" />
              </td>
              <td className="py-3">
                {item.productName}
                {item.variantName ? <span className="block text-xs text-muted">{item.variantName}</span> : null}
              </td>
              <td className="py-3 font-mono text-xs">{item.sku}</td>
              <td className="py-3 text-right text-base font-semibold">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-8 text-xs text-muted">Packed by: ____________________ Date: ______________</p>
    </article>
  );
}
