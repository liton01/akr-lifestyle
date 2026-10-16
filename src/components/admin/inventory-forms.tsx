"use client";

import { SubmitButton } from "@/components/ui/client";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { adjustStockAction } from "@/server/actions/admin/catalog";

/** Inline stock adjustment (add/remove units or set an exact count) with a mandatory reason. */
export function AdjustStockForm({ variantId, current }: { variantId: string; current: number }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(adjustStockAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-ivory">Adjust</summary>
      <form {...formProps} className="mt-2 w-72 space-y-2 rounded-lg border border-line bg-white p-3 text-left shadow-lg" noValidate>
        <input type="hidden" name="variantId" value={variantId} />
        <p className="text-xs text-muted">Current stock: {current}</p>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor={`mode-${variantId}`}>
            Adjustment type
          </label>
          <select id={`mode-${variantId}`} name="mode" defaultValue="DELTA" className="h-9 rounded-md border border-line px-2 text-sm">
            <option value="DELTA">Add / remove (±)</option>
            <option value="SET">Set exact count</option>
          </select>
          <label className="sr-only" htmlFor={`qty-${variantId}`}>
            Quantity
          </label>
          <input id={`qty-${variantId}`} name="quantity" inputMode="numeric" placeholder="e.g. 10 or -2" className="h-9 w-24 rounded-md border border-line px-2 text-sm" required />
        </div>
        {errors?.quantity ? <p className="text-xs text-danger">{errors.quantity[0]}</p> : null}
        <label className="sr-only" htmlFor={`reason-${variantId}`}>
          Reason
        </label>
        <input id={`reason-${variantId}`} name="reason" placeholder="Reason (e.g. new shipment, damaged)" className="h-9 w-full rounded-md border border-line px-2 text-sm" required />
        {errors?.reason ? <p className="text-xs text-danger">{errors.reason[0]}</p> : null}
        <SubmitButton pending={pending} size="sm" className="w-full" pendingText="Saving…">
          Save adjustment
        </SubmitButton>
        {state?.message ? <p className={cn("text-xs", state.ok ? "text-success" : "text-danger")}>{state.message}</p> : null}
      </form>
    </details>
  );
}
