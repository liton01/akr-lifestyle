import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { parseMoney } from "@/lib/money";
import { cn, firstParam, parsePositiveInt } from "@/lib/utils";
import { getActiveBrands, getCategoryIndex } from "@/server/cache";
import { prisma } from "@/server/db";
import { searchCatalog, type CatalogQuery, type CatalogSort } from "@/server/services/storefront";
import { AutoSubmitSelect } from "./catalog-client";
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

  const filters = (
    <form method="get" action={basePath} className="space-y-7" aria-label="Product filters">
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
          <label className="sr-only" htmlFor="price-min">
            Minimum price
          </label>
          <input
            id="price-min"
            name="min"
            inputMode="numeric"
            placeholder="Min"
            defaultValue={query.minPrice !== null && query.minPrice !== undefined ? String(query.minPrice / 100) : ""}
            className="h-9 w-full rounded-md border border-line px-2 text-sm"
          />
          <span className="text-muted">–</span>
          <label className="sr-only" htmlFor="price-max">
            Maximum price
          </label>
          <input
            id="price-max"
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

      <div className="flex gap-2">
        <button type="submit" className="h-9 flex-1 rounded-md bg-ink px-4 text-sm font-medium text-ivory hover:bg-ink-soft">
          Apply filters
        </button>
        {activeFilters ? (
          <Link href={query.q ? `${basePath}?q=${encodeURIComponent(query.q)}` : basePath} className="grid h-9 place-items-center rounded-md border border-line px-3 text-sm hover:bg-ivory">
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );

  return (
    <div className="container-page py-8 lg:py-12">
      {header}
      <div className="mt-8 grid gap-10 lg:grid-cols-[15rem_1fr]">
        <aside className="hidden lg:block">{filters}</aside>
        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <p className="text-sm text-muted" aria-live="polite">
              {total.toLocaleString("en-IN")} product{total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <details className="lg:hidden">
                <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-line px-3 text-sm">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters{activeFilters ? " •" : ""}
                </summary>
                <div className="card absolute left-4 right-4 z-30 mt-2 max-h-[70vh] overflow-y-auto p-5">{filters}</div>
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
                <AutoSubmitSelect id="sort" name="sort" defaultValue={query.sort} options={SORTS} />
                <noscript>
                  <button type="submit" className="h-9 rounded-md border border-line px-3 text-sm">
                    Go
                  </button>
                </noscript>
              </form>
            </div>
          </div>

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
        </div>
      </div>
    </div>
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
