import type { Metadata } from "next";
import { CatalogView, PageHeader } from "@/components/store/catalog";
import { LiveSearchInput } from "@/components/store/live-search-input";
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
            <LiveSearchInput id="search-page-input" defaultValue={q} />
            <button type="submit" className="h-11 rounded-md bg-ink px-5 text-sm font-medium text-ivory hover:bg-ink-soft">
              Search
            </button>
          </form>
        </>
      }
    />
  );
}
