"use client";

import { Check, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/client";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { addToCartAction } from "@/server/actions/cart";

/** Compact add-to-cart used on product cards (single-variant products). */
export function QuickAddButton({ variantId, productName }: { variantId: string; productName: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(addToCartAction, null);
  return (
    <form action={action} className="w-full">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="quantity" value="1" />
      <SubmitButton variant={state?.ok ? "gold" : "primary"} size="sm" className="w-full" aria-label={`Add ${productName} to cart`} pendingText="Adding…">
        {state?.ok ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
        {state?.ok ? "Added" : "Add to cart"}
      </SubmitButton>
      <p className={cn("mt-1 min-h-4 text-xs", state && !state.ok ? "text-danger" : "text-success")} role="status" aria-live="polite">
        {state && !state.ok ? state.message : state?.ok ? (
          <Link href="/cart" className="underline underline-offset-2">
            View cart
          </Link>
        ) : null}
      </p>
    </form>
  );
}
