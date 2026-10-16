"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useTransition } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import type { ActionResult } from "@/lib/action-result";
import { applyCouponAction, removeCartItemAction, removeCouponAction, updateCartItemAction } from "@/server/actions/cart";

export function CartQuantitySelect({ itemId, quantity, max, label }: { itemId: string; quantity: number; max: number; label: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updateCartItemAction, null);
  const [pending, startTransition] = useTransition();
  const options = Array.from({ length: Math.max(max, quantity, 1) }, (_, i) => i + 1);
  return (
    <form action={action}>
      <input type="hidden" name="itemId" value={itemId} />
      <label className="sr-only" htmlFor={`qty-${itemId}`}>
        Quantity for {label}
      </label>
      <select
        id={`qty-${itemId}`}
        name="quantity"
        defaultValue={quantity}
        disabled={pending}
        onChange={(event) => {
          const form = event.currentTarget.form;
          if (form) startTransition(() => action(new FormData(form)));
        }}
        className="h-9 rounded-md border border-line bg-white px-2 text-sm focus:border-gold-dark focus:outline-none"
      >
        {options.map((n) => (
          <option key={n} value={n} disabled={n > max}>
            {n}
          </option>
        ))}
      </select>
      {state && !state.ok ? <p className="mt-1 max-w-48 text-xs text-danger">{state.message}</p> : null}
    </form>
  );
}

export function RemoveItemButton({ itemId, label }: { itemId: string; label: string }) {
  return (
    <form action={removeCartItemAction}>
      <input type="hidden" name="itemId" value={itemId} />
      <button type="submit" className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger" aria-label={`Remove ${label} from cart`}>
        <Trash2 className="h-3.5 w-3.5" /> Remove
      </button>
    </form>
  );
}

export function CouponForm({ appliedCode, error }: { appliedCode: string | null; error: string | null }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(applyCouponAction, null);
  if (appliedCode && !error) {
    return (
      <div className="flex items-center justify-between rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm">
        <span>
          Coupon <strong className="font-semibold">{appliedCode}</strong> applied
        </span>
        <form action={removeCouponAction}>
          <button type="submit" className="text-xs font-medium text-charcoal underline underline-offset-2 hover:text-danger">
            Remove
          </button>
        </form>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="coupon-code" className="text-sm font-medium">
        Have a coupon?
      </label>
      <div className="flex gap-2">
        <input
          id="coupon-code"
          name="code"
          defaultValue={appliedCode ?? ""}
          placeholder="Enter code"
          autoComplete="off"
          className="h-10 flex-1 rounded-md border border-line px-3 text-sm uppercase placeholder:normal-case focus:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
        <SubmitButton variant="outline" pendingText="Checking…">
          Apply
        </SubmitButton>
      </div>
      {appliedCode && error ? <p className="text-xs text-danger">{appliedCode}: {error}</p> : null}
      <FormMessage state={state && !state.ok ? state : null} />
    </form>
  );
}
