"use client";

import { Banknote, CreditCard, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { SubmitButton } from "@/components/ui/client";
import { useActionForm } from "@/components/ui/use-action-form";
import { Alert, Spinner } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/action-result";
import { formatBDT } from "@/lib/money";
import { cn } from "@/lib/utils";
import { placeOrderAction, quoteCheckoutAction, type CheckoutQuote } from "@/server/actions/checkout";
import { TotalsTable } from "./order-summary";

export type CheckoutAddress = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  district: string;
  area: string;
  addressLine: string;
  postalCode: string | null;
  isDefault: boolean;
};

export type CheckoutLine = { id: string; name: string; variant: string | null; quantity: number; imageUrl: string | null; lineSubtotal: number };

type Props = {
  districts: readonly string[];
  addresses: CheckoutAddress[];
  defaults: { fullName: string; phone: string; email: string };
  initialQuote: CheckoutQuote;
  initialDistrict: string;
  lines: CheckoutLine[];
  payment: { cod: boolean; online: boolean };
  signedIn: boolean;
};

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
}

export function CheckoutForm({ districts, addresses, defaults, initialQuote, initialDistrict, lines, payment, signedIn }: Props) {
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const [idempotencyKey] = useState(newKey);
  const { state, pending, formProps } = useActionForm<ActionResult>(placeOrderAction);
  const formRef = useRef<HTMLFormElement>(null);
  const [quote, setQuote] = useState(initialQuote);
  const [quoting, startQuote] = useTransition();
  const [address, setAddress] = useState({
    fullName: defaultAddress?.fullName ?? defaults.fullName,
    phone: defaultAddress?.phone ?? defaults.phone,
    district: defaultAddress?.district ?? initialDistrict,
    area: defaultAddress?.area ?? "",
    addressLine: defaultAddress?.addressLine ?? "",
    postalCode: defaultAddress?.postalCode ?? "",
  });
  const [couponInput, setCouponInput] = useState(initialQuote.couponCode ?? "");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(initialQuote.couponCode);
  const [billingSame, setBillingSame] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "SSLCOMMERZ">(payment.cod ? "COD" : "SSLCOMMERZ");
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  const requote = (next: { district?: string; coupon?: string | null; phone?: string }) => {
    startQuote(async () => {
      const result = await quoteCheckoutAction({
        district: next.district ?? (address.district || null),
        couponCode: next.coupon === undefined ? appliedCoupon : next.coupon,
        phone: next.phone ?? (address.phone || null),
      });
      if (result) setQuote(result);
    });
  };

  // When the server rejects the order: refresh the summary (prices may have changed) and
  // take the customer straight to the first field that needs attention.
  useEffect(() => {
    if (!state || state.ok) return;
    requote({});
    const frame = requestAnimationFrame(() => {
      const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (invalid) {
        invalid.scrollIntoView({ block: "center", behavior: "smooth" });
        invalid.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const update = (field: keyof typeof address) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setAddress((a) => ({ ...a, [field]: event.target.value }));

  const noPaymentMethods = !payment.cod && !payment.online;

  return (
    <form ref={formRef} {...formProps} className="grid gap-10 lg:grid-cols-[1fr_24rem]" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="expectedTotal" value={quote.totals.total} />
      <input type="hidden" name="couponCode" value={appliedCoupon ?? ""} />

      <div className="space-y-8">

        <section className="card space-y-5 p-6" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="text-2xl font-semibold">
            Contact
          </h2>
          {!signedIn ? (
            <p className="text-sm text-muted">
              Have an account?{" "}
              <Link href="/login?next=/checkout" className="link">
                Sign in
              </Link>{" "}
              for faster checkout.
            </p>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Mobile number" name="phone" required errors={errors?.phone}>
              {(p) => (
                <Input
                  {...p}
                  type="tel"
                  autoComplete="tel"
                  placeholder="01XXXXXXXXX"
                  value={address.phone}
                  onChange={update("phone")}
                  onBlur={() => requote({})}
                  required
                />
              )}
            </Field>
            <Field
              label="Email"
              name="email"
              required={paymentMethod === "SSLCOMMERZ"}
              hint={paymentMethod === "SSLCOMMERZ" ? "Required for payment receipts." : "Optional — for your order confirmation."}
              errors={errors?.email}
            >
              {(p) => <Input {...p} type="email" autoComplete="email" defaultValue={defaults.email} />}
            </Field>
          </div>
        </section>

        <section className="card space-y-5 p-6" aria-labelledby="delivery-heading">
          <h2 id="delivery-heading" className="text-2xl font-semibold">
            Delivery address
          </h2>
          {addresses.length ? (
            <div>
              <label htmlFor="saved-address" className="mb-1.5 block text-sm font-medium">
                Saved addresses
              </label>
              <Select
                id="saved-address"
                defaultValue={defaultAddress?.id}
                onChange={(event) => {
                  const chosen = addresses.find((a) => a.id === event.target.value);
                  if (!chosen) return;
                  setAddress({
                    fullName: chosen.fullName,
                    phone: chosen.phone,
                    district: chosen.district,
                    area: chosen.area,
                    addressLine: chosen.addressLine,
                    postalCode: chosen.postalCode ?? "",
                  });
                  requote({ district: chosen.district, phone: chosen.phone });
                }}
              >
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.label ? `${a.label} — ` : "") + `${a.addressLine}, ${a.area}, ${a.district}`}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <Field label="Full name" name="fullName" required errors={errors?.fullName}>
            {(p) => <Input {...p} autoComplete="name" value={address.fullName} onChange={update("fullName")} required />}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="District" name="district" required errors={errors?.district}>
              {(p) => (
                <Select
                  {...p}
                  value={address.district}
                  onChange={(event) => {
                    update("district")(event);
                    requote({ district: event.target.value });
                  }}
                  required
                >
                  <option value="">Choose district</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="City / area" name="area" required errors={errors?.area}>
              {(p) => <Input {...p} autoComplete="address-level2" placeholder="e.g. Dhanmondi" value={address.area} onChange={update("area")} required />}
            </Field>
          </div>
          <Field label="Full address" name="addressLine" required hint="House, road, block or landmark." errors={errors?.addressLine}>
            {(p) => <Input {...p} autoComplete="street-address" value={address.addressLine} onChange={update("addressLine")} required />}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Postal code" name="postalCode" errors={errors?.postalCode}>
              {(p) => <Input {...p} inputMode="numeric" autoComplete="postal-code" value={address.postalCode} onChange={update("postalCode")} />}
            </Field>
          </div>
          <Field label="Delivery instructions" name="deliveryInstructions" hint="Optional — e.g. call before delivery." errors={errors?.deliveryInstructions}>
            {(p) => <Textarea {...p} rows={2} maxLength={500} />}
          </Field>
          {signedIn ? <Checkbox name="saveAddress" defaultChecked={addresses.length === 0} label="Save this address to my account" /> : null}
          <Checkbox
            name="billingSameAsShipping"
            checked={billingSame}
            onChange={(e) => setBillingSame(e.target.checked)}
            label="Billing address is the same as delivery address"
          />
          {!billingSame ? (
            <div className="grid gap-5 rounded-lg bg-ivory/60 p-4 sm:grid-cols-2">
              <Field label="Billing name" name="billingFullName" required errors={errors?.billingFullName}>
                {(p) => <Input {...p} />}
              </Field>
              <Field label="Billing phone" name="billingPhone" errors={errors?.billingPhone}>
                {(p) => <Input {...p} type="tel" />}
              </Field>
              <Field label="Billing district" name="billingDistrict" required errors={errors?.billingDistrict}>
                {(p) => (
                  <Select {...p} defaultValue="">
                    <option value="">Choose district</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Billing address" name="billingAddressLine" required errors={errors?.billingAddressLine} className="sm:col-span-2">
                {(p) => <Input {...p} />}
              </Field>
            </div>
          ) : null}
        </section>

        <section className="card space-y-4 p-6" aria-labelledby="payment-heading">
          <h2 id="payment-heading" className="text-2xl font-semibold">
            Payment
          </h2>
          {noPaymentMethods ? <Alert tone="warning">No payment method is currently available. Please contact us to place your order.</Alert> : null}
          <fieldset className="space-y-3">
            <legend className="sr-only">Payment method</legend>
            {payment.cod ? (
              <PaymentOption
                value="COD"
                checked={paymentMethod === "COD"}
                onSelect={() => setPaymentMethod("COD")}
                icon={<Banknote className="h-5 w-5" />}
                title="Cash on delivery"
                description="Pay in cash when your order arrives."
              />
            ) : null}
            {payment.online ? (
              <PaymentOption
                value="SSLCOMMERZ"
                checked={paymentMethod === "SSLCOMMERZ"}
                onSelect={() => setPaymentMethod("SSLCOMMERZ")}
                icon={<CreditCard className="h-5 w-5" />}
                title="Pay online"
                description="Cards, bKash, Nagad, Rocket and internet banking via SSLCommerz."
              />
            ) : null}
          </fieldset>
          {errors?.paymentMethod ? <p className="text-sm text-danger">{errors.paymentMethod[0]}</p> : null}
        </section>
      </div>

      <aside className="h-fit space-y-5 lg:sticky lg:top-36" aria-label="Order summary">
        <div className="card space-y-5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Summary</h2>
            {quoting ? <Spinner className="text-gold-dark" /> : null}
          </div>
          <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {lines.map((line) => (
              <li key={line.id} className="flex gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-ivory">
                  {line.imageUrl ? <Image src={line.imageUrl} alt="" width={56} height={56} className="h-full w-full object-cover" /> : null}
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] font-bold text-ivory">
                    {line.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="line-clamp-2 font-medium">{line.name}</p>
                  {line.variant ? <p className="text-xs text-muted">{line.variant}</p> : null}
                </div>
                <p className="text-sm tabular-nums">{formatBDT(line.lineSubtotal)}</p>
              </li>
            ))}
          </ul>

          <div className="space-y-2 border-t border-line pt-4">
            <label htmlFor="checkout-coupon" className="text-sm font-medium">
              Coupon code
            </label>
            <div className="flex gap-2">
              <input
                id="checkout-coupon"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Enter code"
                autoComplete="off"
                className="h-10 min-w-0 flex-1 rounded-md border border-line px-3 text-sm focus:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
              {appliedCoupon && !quote.couponError ? (
                <button
                  type="button"
                  className="h-10 rounded-md border border-line px-3 text-sm hover:bg-ivory"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput("");
                    requote({ coupon: null });
                  }}
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  className="h-10 rounded-md border border-ink px-3 text-sm font-medium hover:bg-ink hover:text-ivory"
                  onClick={() => {
                    const code = couponInput.trim() || null;
                    setAppliedCoupon(code);
                    requote({ coupon: code });
                  }}
                >
                  Apply
                </button>
              )}
            </div>
            {appliedCoupon && quote.couponError ? <p className="text-xs text-danger">{quote.couponError}</p> : null}
            {quote.couponCode && !quote.couponError ? <p className="text-xs text-success">Coupon {quote.couponCode} applied.</p> : null}
          </div>

          <div className="border-t border-line pt-4">
            <TotalsTable totals={quote.totals} couponCode={quote.couponCode} deliveryLabel={quote.delivery.zoneName} deliveryPending={!address.district} />
            {quote.delivery.estimatedDays ? <p className="mt-2 text-xs text-muted">Estimated delivery: {quote.delivery.estimatedDays}</p> : null}
            {quote.delivery.amountToFreeDelivery && quote.delivery.amountToFreeDelivery > 0 ? (
              <p className="mt-1 text-xs text-gold-deep">Add {formatBDT(quote.delivery.amountToFreeDelivery)} more for free delivery.</p>
            ) : null}
          </div>

          {quote.issues.length ? (
            <Alert tone="warning" title="Please review your cart">
              <ul className="list-disc pl-4">
                {quote.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <Checkbox
            name="acceptTerms"
            label={
              <>
                I agree to the{" "}
                <Link href="/terms" className="link" target="_blank">
                  terms
                </Link>{" "}
                and{" "}
                <Link href="/return-policy" className="link" target="_blank">
                  return policy
                </Link>
                .
              </>
            }
          />
          {errors?.acceptTerms ? <p className="-mt-3 text-sm text-danger">{errors.acceptTerms[0]}</p> : null}

          {state && !state.ok ? (
            <Alert tone="danger" title="Your order was not placed">
              {state.message}
            </Alert>
          ) : null}
          <SubmitButton pending={pending} size="lg" className="w-full" disabled={quoting || noPaymentMethods || quote.issues.length > 0} pendingText="Placing order…">
            <Lock className="h-4 w-4" />
            {paymentMethod === "SSLCOMMERZ" ? "Continue to payment" : "Place order"} · {formatBDT(quote.totals.total)}
          </SubmitButton>
          <p className="text-center text-xs text-muted">Your total is confirmed by our server when you place the order.</p>
        </div>
      </aside>
    </form>
  );
}

function PaymentOption({
  value,
  checked,
  onSelect,
  icon,
  title,
  description,
}: {
  value: string;
  checked: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors", checked ? "border-ink bg-ivory/60" : "border-line hover:border-ink/40")}>
      <input type="radio" name="paymentMethod" value={value} checked={checked} onChange={onSelect} className="mt-1 h-4 w-4 accent-ink" />
      <span className="text-gold-dark">{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
    </label>
  );
}
