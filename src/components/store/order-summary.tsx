import { formatBDT } from "@/lib/money";
import type { Totals } from "@/lib/pricing/engine";

/** Totals table shared by cart, checkout and order pages. All values come from the server. */
export function TotalsTable({
  totals,
  couponCode,
  deliveryLabel,
  deliveryPending,
}: {
  totals: Totals;
  couponCode?: string | null;
  deliveryLabel?: string | null;
  deliveryPending?: boolean;
}) {
  return (
    <dl className="space-y-2 text-sm">
      <Row label="Subtotal" value={formatBDT(totals.subtotal)} />
      {totals.itemDiscountTotal > 0 ? <Row label="Sale & promotion savings" value={`-${formatBDT(totals.itemDiscountTotal)}`} tone="success" /> : null}
      {totals.couponDiscount > 0 ? <Row label={`Coupon${couponCode ? ` (${couponCode})` : ""}`} value={`-${formatBDT(totals.couponDiscount)}`} tone="success" /> : null}
      <Row
        label={`Delivery${deliveryLabel ? ` — ${deliveryLabel}` : ""}`}
        value={deliveryPending ? "Calculated at checkout" : totals.deliveryFee === 0 ? "Free" : formatBDT(totals.deliveryFee)}
      />
      <div className="flex items-baseline justify-between border-t border-line pt-3 text-base">
        <dt className="font-semibold">Total</dt>
        <dd className="text-xl font-semibold tabular-nums">{formatBDT(totals.total)}</dd>
      </div>
    </dl>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-charcoal">{label}</dt>
      <dd className={tone === "success" ? "tabular-nums text-success" : "tabular-nums text-ink"}>{value}</dd>
    </div>
  );
}
