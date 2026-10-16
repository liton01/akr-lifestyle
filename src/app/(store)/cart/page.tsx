import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/store/catalog";
import { CartQuantitySelect, CouponForm, RemoveItemButton } from "@/components/store/cart-client";
import { TotalsTable } from "@/components/store/order-summary";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Price } from "@/components/ui/price";
import { formatBDT } from "@/lib/money";
import { getSettings } from "@/server/cache";
import { getCartOwner } from "@/server/cart-session";
import { prisma } from "@/server/db";
import { getCartView } from "@/server/services/cart";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default async function CartPage() {
  const settings = await getSettings();
  const owner = await getCartOwner();
  const cart = await getCartView(prisma, owner, {
    freeDeliveryEnabled: settings.commerce.freeDeliveryEnabled,
    maxPerLine: settings.commerce.maxQuantityPerLine,
  });

  if (cart.lines.length === 0) {
    return (
      <div className="container-page py-12">
        <PageHeader breadcrumbs={[{ label: "Cart" }]} title="Your cart" />
        <EmptyState
          className="mt-10"
          icon={<ShoppingBag className="h-10 w-10" />}
          title="Your cart is empty"
          description="Discover our latest electronics, watches and jewellery."
          action={<ButtonLink href="/shop">Start shopping</ButtonLink>}
        />
      </div>
    );
  }

  const hasIssues = !cart.purchasable;
  return (
    <div className="container-page py-8 lg:py-12">
      <PageHeader breadcrumbs={[{ label: "Cart" }]} title="Your cart" description={`${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"}`} />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <section aria-label="Cart items">
          {hasIssues ? (
            <Alert tone="warning" className="mb-4" title="Some items need your attention">
              Please update or remove the highlighted items before checking out.
            </Alert>
          ) : null}
          <ul className="divide-y divide-line border-y border-line">
            {cart.lines.map((line) => {
              const label = line.variantName ? `${line.productName} (${line.variantName})` : line.productName;
              return (
                <li key={line.itemId} className="flex gap-4 py-5">
                  <Link href={`/product/${line.productSlug}`} className="shrink-0">
                    <div className="h-24 w-24 overflow-hidden rounded-lg bg-ivory sm:h-28 sm:w-28">
                      {line.imageUrl ? <Image src={line.imageUrl} alt="" width={112} height={112} className="h-full w-full object-cover" /> : null}
                    </div>
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="font-sans text-sm font-medium">
                        <Link href={`/product/${line.productSlug}`} className="hover:underline">
                          {line.productName}
                        </Link>
                      </h2>
                      {Object.entries(line.variantOptions).length ? (
                        <p className="mt-1 text-xs text-muted">
                          {Object.entries(line.variantOptions)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted">SKU {line.sku}</p>
                      <div className="mt-2">
                        <Price amount={line.price.finalPrice} compareAt={line.price.displayCompareAt} size="sm" />
                        {line.price.discountLabel ? <span className="ml-2 text-xs text-gold-deep">{line.price.discountLabel}</span> : null}
                      </div>
                      {line.issue ? <p className="mt-2 text-sm font-medium text-danger">{line.issue}</p> : null}
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <CartQuantitySelect
                        itemId={line.itemId}
                        quantity={line.quantity}
                        max={Math.min(line.stock, settings.commerce.maxQuantityPerLine)}
                        label={label}
                      />
                      <p className="text-sm font-semibold tabular-nums">{formatBDT(line.lineSubtotal)}</p>
                      <RemoveItemButton itemId={line.itemId} label={label} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link href="/shop" className="mt-6 inline-block text-sm link">
            Continue shopping
          </Link>
        </section>

        <aside className="h-fit space-y-6 lg:sticky lg:top-36" aria-label="Order summary">
          <div className="card space-y-5 p-6">
            <h2 className="text-2xl font-semibold">Order summary</h2>
            <CouponForm appliedCode={cart.couponCode} error={cart.couponError} />
            <TotalsTable totals={cart.totals} couponCode={cart.coupon?.code} deliveryPending />
            {hasIssues ? (
              <span className="block rounded-md bg-ivory px-4 py-3 text-center text-sm text-muted">Resolve cart issues to continue</span>
            ) : (
              <ButtonLink href="/checkout" size="lg" className="w-full">
                Proceed to checkout
              </ButtonLink>
            )}
            <p className="text-center text-xs text-muted">Prices, discounts and stock are re-checked when you place your order.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
