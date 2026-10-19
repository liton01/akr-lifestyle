import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { formatBDT, parseMoney } from "@/lib/money";
import { cn, firstParam, parsePositiveInt } from "@/lib/utils";
import { getActiveBrands, getCategoryIndex } from "@/server/cache";
import { prisma } from "@/server/db";
import { searchCatalog, type CatalogQuery, type CatalogSort } from "@/server/services/storefront";
import { AutoFilterForm, AutoSubmitSelect, CatalogPending, CatalogProvider, CatalogResults } from "./catalog-client";
import { ProductGrid } from "./product-card";

type SearchParams = Record<string, string | string[] | undefined>;

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
];

const FILTER_KEYS = ["brand", "min", "max", "stock", "sale"];

/** The current URL minus the given filter (or one value of it), always back on page 1. */
function hrefWithout(basePath: string, params: SearchParams, remove: string[], value?: string) {
  const next = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined || key === "page") continue;
    for (const v of Array.isArray(raw) ? raw : [raw]) {
      if (remove.includes(key) && (value === undefined || v === value)) continue;
      next.append(key, v);
    }
  }
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function parseCatalogParams(params: SearchParams, brandIdBySlug: Map<string, string>): CatalogQuery & { brandSlugs: string[] } {
  const brandParam = params.brand;
  const brandSlugs = (Array.isArray(brandParam) ? brandParam : brandParam ? [brandParam] : []).slice(0, 20);
  const toMinor = (value: string | undefined) => {
    if (!value) return null;
    const minor = parseMoney(value);
    return minor !== null && minor >= 0 ? minor : null;
  };
  const sortParam = firstParam(params.sort) as CatalogSort | undefined;
  return {
    q: firstParam(params.q)?.trim().slice(0, 100) || undefined,
    brandSlugs,
    brandIds: brandSlugs.map((slug) => brandIdBySlug.get(slug)).filter((id): id is string => Boolean(id)),
    minPrice: toMinor(firstParam(params.min)),
    maxPrice: toMinor(firstParam(params.max)),
    inStock: firstParam(params.stock) === "1",
    onSale: firstParam(params.sale) === "1",
    sort: SORTS.some((s) => s.value === sortParam) ? sortParam : "featured",
    page: parsePositiveInt(params.page, 1, 500),
    pageSize: PAGE_SIZE,
  };
}

export async function CatalogView({
  basePath,
  searchParams,
  categoryId,
  fixedBrandId,
  forceOnSale,
  header,
  emptyTitle = "No products found",
  emptyDescription = "Try removing a filter or searching for something else.",
}: {
  basePath: string;
  searchParams: SearchParams;
  categoryId?: string;
  fixedBrandId?: string;
  forceOnSale?: boolean;
  header?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [brands, categories] = await Promise.all([getActiveBrands(), getCategoryIndex()]);
  const brandIdBySlug = new Map(brands.map((b) => [b.slug, b.id]));
  const query = parseCatalogParams(searchParams, brandIdBySlug);
  const { products, total } = await searchCatalog(prisma, {
    ...query,
    categoryId,
    brandIds: fixedBrandId ? [fixedBrandId] : query.brandIds,
    onSale: forceOnSale || query.onSale,
  });

  const subcategories = categoryId ? categories.childrenOf(categoryId).filter((c) => c.isActive) : categories.childrenOf(null).filter((c) => c.isActive);
  const activeFilters = Boolean(query.brandSlugs.length || query.minPrice !== null || query.maxPrice !== null || query.inStock || (!forceOnSale && query.onSale));

  const clearHref = hrefWithout(basePath, searchParams, FILTER_KEYS);
  const brandName = new Map(brands.map((b) => [b.slug, b.name]));
  const priceLabel =
    query.minPrice != null && query.maxPrice != null
      ? `${formatBDT(query.minPrice)} – ${formatBDT(query.maxPrice)}`
      : query.minPrice != null
        ? `From ${formatBDT(query.minPrice)}`
        : query.maxPrice != null
          ? `Up to ${formatBDT(query.maxPrice)}`
          : null;
  // Removable tags for the filters in effect, shown above the grid.
  const chips: { label: string; href: string }[] = [];
  if (!fixedBrandId) {
    for (const slug of query.brandSlugs) {
      const name = brandName.get(slug);
      if (name) chips.push({ label: name, href: hrefWithout(basePath, searchParams, ["brand"], slug) });
    }
  }
  if (priceLabel) chips.push({ label: priceLabel, href: hrefWithout(basePath, searchParams, ["min", "max"]) });
  if (query.inStock) chips.push({ label: "In stock", href: hrefWithout(basePath, searchParams, ["stock"]) });
  if (!forceOnSale && query.onSale) chips.push({ label: "On sale", href: hrefWithout(basePath, searchParams, ["sale"]) });

  const renderFilters = (idPrefix: string) => (
    <AutoFilterForm action={basePath} label="Product filters" className="space-y-7">
      {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
      {query.sort && query.sort !== "featured" ? <input type="hidden" name="sort" value={query.sort} /> : null}

      {subcategories.length ? (
        <section>
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted">{categoryId ? "Categories" : "Shop by category"}</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {subcategories.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="text-charcoal hover:text-ink hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!fixedBrandId && brands.length ? (
        <fieldset>
          <legend className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted">Brand</legend>
          <div className="mt-3 space-y-2">
            {brands.map((brand) => (
              <label key={brand.id} className="flex items-center gap-2 text-sm text-charcoal">
                <input type="checkbox" name="brand" value={brand.slug} defaultChecked={query.brandSlugs.includes(brand.slug)} className="h-4 w-4 accent-ink" />
                {brand.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted">Price (৳)</legend>
        <div className="mt-3 flex items-center gap-2">
          <label className="sr-only" htmlFor={`${idPrefix}-price-min`}>
            Minimum price
          </label>
          <input
            id={`${idPrefix}-price-min`}
            name="min"
            inputMode="numeric"
            placeholder="Min"
            defaultValue={query.minPrice !== null && query.minPrice !== undefined ? String(query.minPrice / 100) : ""}
            className="h-9 w-full rounded-md border border-line px-2 text-sm"
          />
          <span className="text-muted">–</span>
          <label className="sr-only" htmlFor={`${idPrefix}-price-max`}>
            Maximum price
          </label>
          <input
            id={`${idPrefix}-price-max`}
            name="max"
            inputMode="numeric"
            placeholder="Max"
            defaultValue={query.maxPrice !== null && query.maxPrice !== undefined ? String(query.maxPrice / 100) : ""}
            className="h-9 w-full rounded-md border border-line px-2 text-sm"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted">Availability & offers</legend>
        <label className="mt-3 flex items-center gap-2 text-sm text-charcoal">
          <input type="checkbox" name="stock" value="1" defaultChecked={query.inStock} className="h-4 w-4 accent-ink" />
          In stock only
        </label>
        {!forceOnSale ? (
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" name="sale" value="1" defaultChecked={query.onSale} className="h-4 w-4 accent-ink" />
            On sale
          </label>
        ) : null}
      </fieldset>

      {/* Filters apply on their own; the button is only needed when JavaScript is off. */}
      <noscript>
        <button type="submit" className="h-9 w-full rounded-md bg-ink px-4 text-sm font-medium text-ivory hover:bg-ink-soft">
          Apply filters
        </button>
      </noscript>
      {activeFilters ? (
        <Link href={clearHref} scroll={false} className="inline-flex h-9 w-full items-center justify-center rounded-md border border-line px-3 text-sm hover:bg-ivory">
          Clear all filters
        </Link>
      ) : null}
    </AutoFilterForm>
  );

  return (
    <CatalogProvider>
      <div className="container-page py-8 lg:py-12">
        {header}
        <div className="mt-8 grid gap-10 lg:grid-cols-[15rem_1fr]">
          <aside className="hidden lg:block">{renderFilters("sidebar")}</aside>
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted" aria-live="polite">
                  {total.toLocaleString("en-IN")} product{total === 1 ? "" : "s"}
                </p>
                <CatalogPending />
              </div>
              <div className="flex items-center gap-2">
                <details className="lg:hidden">
                  <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-line px-3 text-sm">
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{activeFilters ? " •" : ""}
                  </summary>
                  <div className="card absolute left-4 right-4 z-30 mt-2 max-h-[70vh] overflow-y-auto p-5">{renderFilters("panel")}</div>
                </details>
                <form method="get" action={basePath} className="flex items-center gap-2">
                  {Object.entries(searchParams).map(([key, value]) =>
                    key === "sort" || key === "page" || value === undefined
                      ? null
                      : (Array.isArray(value) ? value : [value]).map((v, i) => <input key={`${key}-${i}`} type="hidden" name={key} value={v} />),
                  )}
                  <label htmlFor="sort" className="text-sm text-muted">
                    Sort
                  </label>
                  <AutoSubmitSelect key={query.sort} id="sort" name="sort" defaultValue={query.sort} options={SORTS} />
                  <noscript>
                    <button type="submit" className="h-9 rounded-md border border-line px-3 text-sm">
                      Go
                    </button>
                  </noscript>
                </form>
              </div>
            </div>

            {chips.length ? (
              <div role="group" aria-label="Active filters" className="-mt-2 mb-6 flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                  <Link
                    key={chip.href + chip.label}
                    href={chip.href}
                    scroll={false}
                    aria-label={`Remove filter: ${chip.label}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-ivory px-3 py-1 text-sm text-ink transition-colors hover:border-gold hover:bg-ivory-dark"
                  >
                    {chip.label}
                    <X className="h-3.5 w-3.5 text-gold-deep" aria-hidden="true" />
                  </Link>
                ))}
                <Link href={clearHref} scroll={false} className="ml-1 text-sm font-medium text-gold-deep underline-offset-4 hover:underline">
                  Clear all
                </Link>
              </div>
            ) : null}

            <CatalogResults>
              {products.length ? (
                <ProductGrid products={products} priorityCount={4} />
              ) : (
                <EmptyState
                  title={emptyTitle}
                  description={emptyDescription}
                  action={
                    <ButtonLink href="/shop" variant="outline">
                      Browse all products
                    </ButtonLink>
                  }
                />
              )}
              <Pagination page={query.page} pageSize={query.pageSize} total={total} basePath={basePath} searchParams={searchParams} />
            </CatalogResults>
          </div>
        </div>
      </div>
    </CatalogProvider>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  className?: string;
}) {
  return (
    <header className={cn("max-w-3xl", className)}>
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}
      {eyebrow ? <p className="eyebrow mt-4">{eyebrow}</p> : null}
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{title}</h1>
      {description ? <div className="mt-3 text-base text-muted">{description}</div> : null}
    </header>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <li>
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            {item.href && index < items.length - 1 ? (
              <Link href={item.href} className="hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span aria-current={index === items.length - 1 ? "page" : undefined} className="text-charcoal">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
