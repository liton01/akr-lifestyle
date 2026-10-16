"use client";

import type { OrderStatus } from "@prisma/client";
import { useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionResult } from "@/lib/action-result";
import { ORDER_STATUS_LABELS, REFUND_METHOD_LABELS } from "@/lib/constants";
import { formatBDT } from "@/lib/money";
import {
  receiveReturnAction,
  recordRefundAction,
  staffCreateReturnAction,
  updateAdminNoteAction,
  updateOrderStatusAction,
  updateShippingAction,
} from "@/server/actions/admin/orders";

export function OrderStatusForm({
  orderId,
  current,
  allowed,
  courierName,
  trackingNumber,
}: {
  orderId: string;
  current: OrderStatus;
  allowed: OrderStatus[];
  courierName: string;
  trackingNumber: string;
}) {
  const { state, pending, formProps } = useActionForm<ActionResult>(updateOrderStatusAction);
  // The choice is remembered per current status, so after a successful update the form
  // falls back to the first transition allowed from the new status while keeping its message.
  const [choice, setChoice] = useState<{ from: OrderStatus; to: OrderStatus } | null>(null);
  const next: OrderStatus | "" = choice && choice.from === current && allowed.includes(choice.to) ? choice.to : (allowed[0] ?? "");
  if (allowed.length === 0) {
    return (
      <div className="space-y-3">
        <FormMessage state={state} />
        <p className="text-sm text-muted">This order is {ORDER_STATUS_LABELS[current].toLowerCase()} — no further status changes are possible.</p>
      </div>
    );
  }
  return (
    <form {...formProps} className="space-y-3" noValidate>
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />
      <Field label="Move order to" name="status">
        {(p) => (
          <Select {...p} value={next} onChange={(e) => setChoice({ from: current, to: e.target.value as OrderStatus })}>
            {allowed.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
                {s === "CANCELLED" ? " (restores stock)" : s === "RETURNED" ? " (returned to sender, restores stock)" : ""}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {next === "SHIPPED" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Courier" name="courierName">
            {(p) => <Input {...p} defaultValue={courierName} placeholder="e.g. Pathao, Steadfast" />}
          </Field>
          <Field label="Tracking number" name="trackingNumber">
            {(p) => <Input {...p} defaultValue={trackingNumber} />}
          </Field>
        </div>
      ) : null}
      <Field label="Note (optional)" name="note" hint="Saved in the status history; included in the customer notification.">
        {(p) => <Textarea {...p} rows={2} maxLength={500} />}
      </Field>
      <Checkbox name="notifyCustomer" defaultChecked label="Notify the customer" />
      <SubmitButton pending={pending} variant={next === "CANCELLED" ? "danger" : "primary"} pendingText="Updating…">
        Update status
      </SubmitButton>
    </form>
  );
}

export function ShippingForm({ orderId, courierName, trackingNumber }: { orderId: string; courierName: string; trackingNumber: string }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(updateShippingAction);
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Courier" name="courierName">
          {(p) => <Input {...p} defaultValue={courierName} />}
        </Field>
        <Field label="Tracking number" name="trackingNumber">
          {(p) => <Input {...p} defaultValue={trackingNumber} />}
        </Field>
      </div>
      <SubmitButton pending={pending} variant="outline" size="sm">
        Save shipping details
      </SubmitButton>
    </form>
  );
}

export function AdminNoteForm({ orderId, note }: { orderId: string; note: string }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(updateAdminNoteAction);
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor="admin-note" className="sr-only">
        Internal note
      </label>
      <Textarea id="admin-note" name="adminNote" rows={3} defaultValue={note} placeholder="Only visible to staff" maxLength={2000} />
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} variant="outline" size="sm">
          Save note
        </SubmitButton>
        {state?.message ? <span className={state.ok ? "text-xs text-success" : "text-xs text-danger"}>{state.message}</span> : null}
      </div>
    </form>
  );
}

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
}

export function RefundForm({ orderId, refundable, returns }: { orderId: string; refundable: number; returns: { id: string; returnNumber: string }[] }) {
  const [key, setKey] = useState(uuid);
  const { state, pending, formProps } = useActionForm<ActionResult>(async (prev, formData) => {
    const result = await recordRefundAction(prev, formData);
    if (result.ok) setKey(uuid());
    return result;
  });
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-3" noValidate>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <FormMessage state={state} />
      <p className="text-xs text-muted">Refundable: {formatBDT(refundable)}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount (৳)" name="amount" required errors={errors?.amount}>
          {(p) => <Input {...p} inputMode="decimal" defaultValue={(refundable / 100).toFixed(2)} />}
        </Field>
        <Field label="Method" name="method" required errors={errors?.method}>
          {(p) => (
            <Select {...p} defaultValue="BKASH">
              {Object.entries(REFUND_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Reference" name="reference" hint="Transaction ID or note" errors={errors?.reference}>
          {(p) => <Input {...p} />}
        </Field>
        {returns.length ? (
          <Field label="Linked return" name="returnRequestId">
            {(p) => (
              <Select {...p} defaultValue="">
                <option value="">None</option>
                {returns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.returnNumber}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
      </div>
      <Field label="Reason" name="reason" required errors={errors?.reason}>
        {(p) => <Input {...p} placeholder="e.g. Cancelled after payment" />}
      </Field>
      <SubmitButton pending={pending} variant="outline" pendingText="Recording…">
        Record refund
      </SubmitButton>
    </form>
  );
}

export function ReceiveReturnForm({ id, items }: { id: string; items: { id: string; label: string; quantity: number }[] }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(receiveReturnAction);
  return (
    <form {...formProps} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <p className="text-xs text-muted">Tick items that are resellable and should go back into stock:</p>
      {items.map((item) => (
        <Checkbox key={item.id} name="restock" value={item.id} defaultChecked label={`${item.label} × ${item.quantity}`} />
      ))}
      <SubmitButton pending={pending} size="sm" pendingText="Saving…">
        Mark as received
      </SubmitButton>
      {state?.message ? <p className={state.ok ? "text-xs text-success" : "text-xs text-danger"}>{state.message}</p> : null}
    </form>
  );
}

export function StaffReturnForm({ orderId, items }: { orderId: string; items: { id: string; label: string; returnable: number }[] }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(staffCreateReturnAction);
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />
      {items.map((item) => (
        <label key={item.id} className="flex items-center justify-between gap-3 text-sm">
          <span>{item.label}</span>
          <select name={`qty:${item.id}`} defaultValue="0" className="h-8 rounded-md border border-line px-2">
            {Array.from({ length: item.returnable + 1 }, (_, n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label htmlFor="staff-return-reason" className="block text-sm font-medium">
        Reason
      </label>
      <Input id="staff-return-reason" name="reason" required />
      <SubmitButton pending={pending} variant="outline" size="sm">
        Create return
      </SubmitButton>
    </form>
  );
}
