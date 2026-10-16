"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit, FormMessage, SubmitButton } from "@/components/ui/client";
import { useActionForm } from "@/components/ui/use-action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/action-result";
import {
  deleteAddressAction,
  requestReturnAction,
  saveAddressAction,
  setDefaultAddressAction,
  updateProfileAction,
} from "@/server/actions/account";
import { changePasswordAction, resendVerificationAction } from "@/server/actions/auth";
import { cancelOwnOrderAction } from "@/server/actions/checkout";

export function ResendVerificationButton() {
  const [state, action] = useActionState<ActionResult | null, FormData>(async () => resendVerificationAction(), null);
  return (
    <form action={action} className="mt-2">
      {state ? <p className="mb-2 text-sm">{state.message}</p> : null}
      <SubmitButton variant="outline" size="sm" pendingText="Sending…">
        Resend verification email
      </SubmitButton>
    </form>
  );
}

export function ProfileForm({ defaults }: { defaults: { name: string; phone: string; gender: string; marketingOptIn: boolean } }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(updateProfileAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field label="Full name" name="name" required errors={errors?.name}>
        {(p) => <Input {...p} defaultValue={defaults.name} autoComplete="name" required />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Mobile number" name="phone" errors={errors?.phone}>
          {(p) => <Input {...p} type="tel" defaultValue={defaults.phone} placeholder="01XXXXXXXXX" />}
        </Field>
        <Field label="Gender" name="gender" errors={errors?.gender}>
          {(p) => (
            <Select {...p} defaultValue={defaults.gender}>
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </Select>
          )}
        </Field>
      </div>
      <Checkbox name="marketingOptIn" defaultChecked={defaults.marketingOptIn} label="Send me offers and new arrivals" />
      <SubmitButton pending={pending} pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const { state, pending, formProps } = useActionForm<ActionResult>(changePasswordAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field label="Current password" name="currentPassword" required errors={errors?.currentPassword}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" required />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="New password" name="password" required hint="At least 8 characters." errors={errors?.password}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
        </Field>
        <Field label="Confirm new password" name="confirmPassword" required errors={errors?.confirmPassword}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
        </Field>
      </div>
      <SubmitButton pending={pending} pendingText="Updating…">Change password</SubmitButton>
    </form>
  );
}

export type AddressValues = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  district: string;
  area: string;
  addressLine: string;
  postalCode: string;
  isDefault: boolean;
};

export function AddressForm({ districts, initial, onDone }: { districts: readonly string[]; initial?: AddressValues; onDone?: () => void }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(async (prev, formData) => {
    const result = await saveAddressAction(prev, formData);
    if (result.ok) onDone?.();
    return result;
  });
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-4" noValidate>
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Label" name="label" hint="e.g. Home, Office" errors={errors?.label}>
          {(p) => <Input {...p} defaultValue={initial?.label} />}
        </Field>
        <Field label="Recipient name" name="fullName" required errors={errors?.fullName}>
          {(p) => <Input {...p} defaultValue={initial?.fullName} required />}
        </Field>
        <Field label="Mobile number" name="phone" required errors={errors?.phone}>
          {(p) => <Input {...p} type="tel" defaultValue={initial?.phone} placeholder="01XXXXXXXXX" required />}
        </Field>
        <Field label="District" name="district" required errors={errors?.district}>
          {(p) => (
            <Select {...p} defaultValue={initial?.district ?? ""} required>
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
          {(p) => <Input {...p} defaultValue={initial?.area} required />}
        </Field>
        <Field label="Postal code" name="postalCode" errors={errors?.postalCode}>
          {(p) => <Input {...p} inputMode="numeric" defaultValue={initial?.postalCode} />}
        </Field>
      </div>
      <Field label="Full address" name="addressLine" required errors={errors?.addressLine}>
        {(p) => <Input {...p} defaultValue={initial?.addressLine} required />}
      </Field>
      <Checkbox name="isDefault" defaultChecked={initial?.isDefault} label="Use as my default address" />
      <div className="flex gap-2">
        <SubmitButton pending={pending} pendingText="Saving…">{initial ? "Save address" : "Add address"}</SubmitButton>
        {onDone ? (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function AddressCard({ address, districts }: { address: AddressValues; districts: readonly string[] }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="card p-5">
        <AddressForm districts={districts} initial={address} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <div className="card flex h-full flex-col p-5 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{address.label || "Address"}</p>
        {address.isDefault ? <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold-deep">Default</span> : null}
      </div>
      <address className="mt-2 flex-1 not-italic leading-6 text-charcoal">
        {address.fullName}
        <br />
        {address.phone}
        <br />
        {address.addressLine}
        <br />
        {[address.area, address.district, address.postalCode].filter(Boolean).join(", ")}
      </address>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
        {!address.isDefault ? (
          <form action={setDefaultAddressAction}>
            <input type="hidden" name="id" value={address.id} />
            <Button type="submit" variant="ghost" size="sm">
              Make default
            </Button>
          </form>
        ) : null}
        <form action={deleteAddressAction}>
          <input type="hidden" name="id" value={address.id} />
          <ConfirmSubmit title="Delete this address?" confirmLabel="Delete" variant="ghost">
            Delete
          </ConfirmSubmit>
        </form>
      </div>
    </div>
  );
}

export function NewAddressPanel({ districts }: { districts: readonly string[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}>Add a new address</Button>;
  return (
    <div className="card p-5">
      <h2 className="mb-4 text-xl font-semibold">New address</h2>
      <AddressForm districts={districts} onDone={() => setOpen(false)} />
    </div>
  );
}

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const { state, formProps } = useActionForm<ActionResult>(cancelOwnOrderAction);
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />
      {!state?.ok ? (
        <>
          <label htmlFor="cancel-reason" className="block text-sm font-medium">
            Reason (optional)
          </label>
          <Textarea id="cancel-reason" name="reason" rows={2} maxLength={300} />
          <ConfirmSubmit title="Cancel this order?" description="Items will be released back to stock. This cannot be undone." confirmLabel="Cancel order">
            Cancel order
          </ConfirmSubmit>
        </>
      ) : null}
    </form>
  );
}

export function ReturnRequestForm({
  orderId,
  items,
}: {
  orderId: string;
  items: { id: string; name: string; variant: string | null; returnable: number }[];
}) {
  const { state, pending, formProps } = useActionForm<ActionResult>(requestReturnAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Items to return</legend>
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm">
            <span>
              {item.name}
              {item.variant ? <span className="text-muted"> ({item.variant})</span> : null}
            </span>
            <label className="flex items-center gap-2">
              <span className="text-xs text-muted">Qty</span>
              <select name={`qty:${item.id}`} defaultValue="0" className="h-8 rounded-md border border-line px-2 text-sm">
                {Array.from({ length: item.returnable + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </fieldset>
      <Field label="Reason for return" name="reason" required errors={errors?.reason}>
        {(p) => <Textarea {...p} rows={3} maxLength={1000} required />}
      </Field>
      <SubmitButton pending={pending} variant="outline" pendingText="Submitting…">
        Submit return request
      </SubmitButton>
    </form>
  );
}
