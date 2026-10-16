"use client";

import { Check, Minus, Plus, ShoppingBag, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Badge } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/client";
import { Price } from "@/components/ui/price";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { addToCartAction } from "@/server/actions/cart";
import type { ProductDetailVariant } from "@/server/services/storefront";

export function ProductGallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {images.length > 1 ? (
        <ul className="flex gap-2 sm:flex-col" aria-label="Product images">
          {images.map((image, index) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-pressed={index === active}
                className={cn(
                  "block h-16 w-16 overflow-hidden rounded-lg border-2 bg-ivory sm:h-20 sm:w-20",
                  index === active ? "border-ink" : "border-transparent hover:border-line",
                )}
              >
                <Image src={image.url} alt="" width={80} height={80} className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-card)] bg-ivory">
        {current ? (
          <Image src={current.url} alt={current.alt || name} fill priority sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
        ) : null}
      </div>
    </div>
  );
}

type Attribute = {
  id: string;
  name: string;
  displayType: "TEXT" | "COLOR";
  values: { id: string; value: string; colorHex: string | null }[];
};

export function VariantPurchase({
  productName,
  attributes,
  variants,
  maxPerLine,
}: {
  productName: string;
  attributes: Attribute[];
  variants: ProductDetailVariant[];
  maxPerLine: number;
}) {
  const initial = variants.find((v) => v.stock > 0) ?? variants[0]!;
  const [selection, setSelection] = useState<Record<string, string>>(initial.options);
  const [quantity, setQuantity] = useState(1);
  const [state, action] = useActionState<ActionResult | null, FormData>(addToCartAction, null);

  const variant = useMemo(
    () => variants.find((v) => attributes.every((a) => v.options[a.id] === selection[a.id])) ?? null,
    [variants, attributes, selection],
  );
  const maxQuantity = variant ? Math.max(0, Math.min(variant.stock, maxPerLine)) : 0;
  const safeQuantity = Math.min(Math.max(quantity, 1), Math.max(maxQuantity, 1));

  const isValueAvailable = (attributeId: string, valueId: string) =>
    variants.some((v) => v.options[attributeId] === valueId && v.stock > 0 && attributes.every((a) => a.id === attributeId || v.options[a.id] === selection[a.id]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {variant ? <Price amount={variant.price.finalPrice} compareAt={variant.price.displayCompareAt} size="lg" /> : <span className="text-muted">Unavailable</span>}
        {variant && variant.price.savingsPercent > 0 ? (
          <Badge tone="solid">
            {variant.price.discountLabel && variant.price.discountLabel !== "Sale" ? variant.price.discountLabel : `Save ${variant.price.savingsPercent}%`}
          </Badge>
        ) : null}
      </div>

      {attributes.map((attribute) => (
        <fieldset key={attribute.id}>
          <legend className="text-sm font-medium">
            {attribute.name}:{" "}
            <span className="font-normal text-muted">{attribute.values.find((v) => v.id === selection[attribute.id])?.value ?? "Select"}</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {attribute.values.map((value) => {
              const selected = selection[attribute.id] === value.id;
              const available = isValueAvailable(attribute.id, value.id);
              return (
                <button
                  key={value.id}
                  type="button"
                  onClick={() => setSelection((s) => ({ ...s, [attribute.id]: value.id }))}
                  aria-pressed={selected}
                  aria-label={`${attribute.name}: ${value.value}${available ? "" : " (out of stock)"}`}
                  className={cn(
                    "relative inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-full border px-4 text-sm transition-colors",
                    selected ? "border-ink bg-ink text-ivory" : "border-line hover:border-ink",
                    !available && "text-muted line-through decoration-muted/70",
                  )}
                >
                  {attribute.displayType === "COLOR" && value.colorHex ? (
                    <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: value.colorHex }} aria-hidden="true" />
                  ) : null}
                  {value.value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <p className="text-sm" aria-live="polite">
        {!variant ? (
          <span className="text-danger">This combination is not available.</span>
        ) : variant.stock <= 0 ? (
          <span className="font-medium text-danger">Out of stock</span>
        ) : variant.stockState === "low" ? (
          <span className="font-medium text-warning">Only {variant.stock} left in stock</span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <Check className="h-4 w-4" aria-hidden="true" /> In stock
          </span>
        )}
        {variant ? <span className="ml-3 text-xs text-muted">SKU {variant.sku}</span> : null}
      </p>

      <form action={action} className="space-y-4">
        <input type="hidden" name="variantId" value={variant?.id ?? ""} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex h-12 items-center rounded-md border border-line" role="group" aria-label="Quantity">
            <button
              type="button"
              className="grid h-full w-11 place-items-center hover:bg-ivory disabled:opacity-40"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={safeQuantity <= 1}
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              name="quantity"
              value={safeQuantity}
              onChange={(e) => setQuantity(Number.parseInt(e.target.value, 10) || 1)}
              inputMode="numeric"
              className="h-full w-12 border-x border-line text-center text-sm focus:outline-none"
              aria-label="Quantity"
            />
            <button
              type="button"
              className="grid h-full w-11 place-items-center hover:bg-ivory disabled:opacity-40"
              onClick={() => setQuantity((q) => Math.min(maxQuantity || 1, q + 1))}
              disabled={safeQuantity >= maxQuantity}
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <SubmitButton size="lg" className="flex-1" disabled={!variant || variant.stock <= 0} pendingText="Adding…">
            <ShoppingBag className="h-4 w-4" /> Add to cart
          </SubmitButton>
        </div>
        <SubmitButton name="buyNow" value="1" variant="gold" size="lg" className="w-full" disabled={!variant || variant.stock <= 0}>
          <Zap className="h-4 w-4" /> Buy now
        </SubmitButton>
        <div role="status" aria-live="polite" className="min-h-5 text-sm">
          {state?.ok ? (
            <span className="text-success">
              {productName} was added to your cart.{" "}
              <Link href="/cart" className="font-medium underline underline-offset-4">
                View cart
              </Link>
            </span>
          ) : state && !state.ok ? (
            <span className="text-danger">{state.message}</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
