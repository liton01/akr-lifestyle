import type { Metadata } from "next";
import { CatalogView, PageHeader } from "@/components/store/catalog";
import { firstParam } from "@/lib/utils";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const q = firstParam((await searchParams).q)?.trim();
  return { title: q ? `Search: ${q.slice(0, 60)}` : "Search", robots: { index: false } };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = await searchParams;
  const q = firstParam(params.q)?.trim().slice(0, 100) ?? "";
  return (
    <CatalogView
      basePath="/search"
      searchParams={params}
      emptyTitle={q ? `No results for “${q}”` : "Start typing to search"}
      emptyDescription={q ? "Check the spelling, try a more general word, or browse our categories." : undefined}
      header={
        <>
          <PageHeader breadcrumbs={[{ label: "Search" }]} title={q ? `Results for “${q}”` : "Search products"} />
          <form action="/search" method="get" role="search" className="mt-6 flex max-w-xl gap-2">
            <label htmlFor="search-page-input" className="sr-only">
              Search products
            </label>
            <input
              id="search-page-input"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search by name, brand or SKU"
              className="h-11 flex-1 rounded-md border border-line px-4 text-sm focus:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <button type="submit" className="h-11 rounded-md bg-ink px-5 text-sm font-medium text-ivory hover:bg-ink-soft">
              Search
            </button>
          </form>
        </>
      }
    />
  );
}
