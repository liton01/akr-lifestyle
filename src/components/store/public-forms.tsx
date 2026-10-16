"use client";

import { FormMessage, SubmitButton } from "@/components/ui/client";
import { useActionForm } from "@/components/ui/use-action-form";
import { Field, Input, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/action-result";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { formatBDT } from "@/lib/money";
import { TRACKING_STEPS } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { contactAction, trackOrderAction, type TrackResult } from "@/server/actions/public";

export function TrackOrderForm({ timeZone }: { timeZone: string }) {
  const { state, pending, formProps } = useActionForm<ActionResult<TrackResult>>(trackOrderAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const result = state?.ok ? state.data : undefined;
  return (
    <div className="space-y-8">
      <form {...formProps} className="card grid gap-5 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        <Field label="Order number" name="orderNumber" required errors={errors?.orderNumber}>
          {(p) => <Input {...p} placeholder="AKR261016-XXXXX" autoCapitalize="characters" required />}
        </Field>
        <Field label="Phone number used for the order" name="phone" required errors={errors?.phone}>
          {(p) => <Input {...p} type="tel" placeholder="01XXXXXXXXX" required />}
        </Field>
        <SubmitButton pending={pending} size="lg" pendingText="Searching…">
          Track order
        </SubmitButton>
      </form>
      {state && !state.ok ? <FormMessage state={state} /> : null}
      {result ? (
        <section className="card space-y-6 p-6" aria-live="polite">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Order</p>
              <p className="font-mono text-lg font-semibold">{result.orderNumber}</p>
              <p className="text-sm text-muted">
                Placed {new Date(result.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone })} · {result.itemCount} item
                {result.itemCount === 1 ? "" : "s"} · {formatBDT(result.total)}
              </p>
            </div>
            <div className="text-sm sm:text-right">
              <p>
                Status: <strong>{ORDER_STATUS_LABELS[result.status as keyof typeof ORDER_STATUS_LABELS]}</strong>
              </p>
              <p className="text-muted">
                {PAYMENT_METHOD_LABELS[result.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS]} ·{" "}
                {PAYMENT_STATUS_LABELS[result.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS]}
              </p>
            </div>
          </div>
          {result.status === "CANCELLED" || result.status === "RETURNED" ? (
            <p className="rounded-md bg-danger/5 p-3 text-sm text-danger">This order was {result.status === "CANCELLED" ? "cancelled" : "returned"}.</p>
          ) : (
            <ol className="grid grid-cols-3 gap-y-4 sm:grid-cols-6">
              {TRACKING_STEPS.map((step) => {
                const event = result.history.find((h) => h.status === step);
                const reachedIndex = TRACKING_STEPS.indexOf(result.status as (typeof TRACKING_STEPS)[number]);
                const done = TRACKING_STEPS.indexOf(step) <= reachedIndex;
                return (
                  <li key={step} className="text-center">
                    <span className={cn("mx-auto block h-3 w-3 rounded-full", done ? "bg-ink" : "bg-line")} aria-hidden="true" />
                    <span className={cn("mt-2 block text-xs font-medium", done ? "text-ink" : "text-muted")}>{ORDER_STATUS_LABELS[step]}</span>
                    {event ? (
                      <span className="block text-[11px] text-muted">
                        {new Date(event.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone })}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
          {result.trackingNumber ? (
            <p className="text-sm">
              Courier: {result.courierName ?? "—"} · Tracking number <span className="font-mono">{result.trackingNumber}</span>
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function ContactForm() {
  const { state, pending, formProps } = useActionForm<ActionResult>(contactAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form {...formProps} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" name="name" required errors={errors?.name}>
          {(p) => <Input {...p} autoComplete="name" required />}
        </Field>
        <Field label="Email" name="email" required errors={errors?.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" required />}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone" name="phone" errors={errors?.phone}>
          {(p) => <Input {...p} type="tel" autoComplete="tel" />}
        </Field>
        <Field label="Subject" name="subject" required errors={errors?.subject}>
          {(p) => <Input {...p} required />}
        </Field>
      </div>
      <Field label="Message" name="message" required errors={errors?.message}>
        {(p) => <Textarea {...p} rows={6} maxLength={5000} required />}
      </Field>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <SubmitButton pending={pending} size="lg" pendingText="Sending…">
        Send message
      </SubmitButton>
    </form>
  );
}
