import Link from "next/link";
import { Badge } from "@/components/ui/feedback";
import { Price } from "@/components/ui/price";
import type { ProductCardData } from "@/server/services/storefront";
import { QuickAddButton } from "./add-to-cart";
import { CardMedia } from "./card-media";

export function ProductCard({ product, priority, autoplayDelayMs }: { product: ProductCardData; priority?: boolean; autoplayDelayMs?: number }) {
  const href = `/product/${product.slug}`;
  return (
    <article className="group flex h-full flex-col">
      <CardMedia href={href} name={product.name} images={product.images} priority={priority} autoplayDelayMs={autoplayDelayMs} raiseDots={!product.inStock}>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.price.discountLabel || product.price.savingsPercent > 0 ? (
            <Badge tone="solid">
              {product.price.discountLabel && product.price.discountLabel !== "Sale"
                ? product.price.discountLabel
                : `-${product.price.savingsPercent}%`}
            </Badge>
          ) : null}
          {product.isNewArrival ? <Badge tone="light">New</Badge> : null}
          {product.isBestSeller ? <Badge tone="dark">Best seller</Badge> : null}
        </div>
        {!product.inStock ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md bg-white/90 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-charcoal">
            Out of stock
          </div>
        ) : null}
      </CardMedia>
      <div className="flex flex-1 flex-col pt-3">
        {product.brandName ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-dark">{product.brandName}</p> : null}
        <h3 className="mt-1 line-clamp-2 font-sans text-sm font-medium leading-5 text-ink">
          <Link href={href} className="hover:underline hover:decoration-gold hover:underline-offset-4">
            {product.name}
          </Link>
        </h3>
        <div className="mt-2">
          <Price amount={product.price.finalPrice} compareAt={product.price.displayCompareAt} from={product.priceFrom} size="sm" />
        </div>
        {product.lowStock ? <p className="mt-1 text-xs font-medium text-warning">Only a few left</p> : null}
        <div className="mt-auto pt-3">
          {product.quickAddVariantId ? (
            <QuickAddButton variantId={product.quickAddVariantId} productName={product.name} />
          ) : (
            <Link
              href={href}
              className="inline-flex h-8 w-full items-center justify-center rounded-md border border-ink/80 text-sm font-medium hover:bg-ink hover:text-ivory"
            >
              {product.inStock ? "Choose options" : "View details"}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0, sixColumns = false }: { products: ProductCardData[]; priorityCount?: number; sixColumns?: boolean }) {
  return (
    <ul className={`grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 ${sixColumns ? "xl:grid-cols-6" : "xl:grid-cols-4"}`}>
      {products.map((product, index) => (
        <li key={product.id}>
          {/* Stagger autoplay along each row, so the images change in a gentle wave rather than all at once. */}
          <ProductCard product={product} priority={index < priorityCount} autoplayDelayMs={(index % 4) * 800} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="space-y-3">
          <div className="skeleton aspect-square w-full" />
          <div className="skeleton h-3 w-1/3" />
          <div className="skeleton h-4 w-4/5" />
          <div className="skeleton h-4 w-1/4" />
        </li>
      ))}
    </ul>
  );
}
