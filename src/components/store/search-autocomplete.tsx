"use client";

import { ArrowRight, Search } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Spinner } from "@/components/ui/feedback";
import { formatBDT } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { SearchSuggestion } from "@/lib/search";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

/** Bold the first case-insensitive occurrence of `query` in `text`. */
function highlight(text: string, query: string): ReactNode {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || index < 0) return text;
  return (
    <Fragment>
      {text.slice(0, index)}
      <mark className="bg-transparent font-semibold text-ink">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </Fragment>
  );
}

/**
 * Header search with type-ahead suggestions. Typing two or more characters shows matching
 * products; arrow keys move through them, Enter opens the highlighted product (or the full
 * results page), Escape closes. Without JavaScript it is a normal GET form to /search.
 */
export function SearchAutocomplete({ placeholder = "Search watches, earbuds, rings…", className }: { placeholder?: string; className?: string }) {
  const router = useRouter();
  const inputId = useId();
  const listId = useId();
  const containerRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSuggestion[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const trimmed = query.trim();
  const searchHref = `/search?q=${encodeURIComponent(trimmed)}`;
  const showPanel = open && trimmed.length >= MIN_CHARS;
  const optionCount = (results?.length ?? 0) + (results && results.length ? 1 : 0); // products + "see all"

  // Fetch suggestions shortly after the user stops typing; stale requests are aborted.
  useEffect(() => {
    if (trimmed.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const json = (await response.json()) as { products: SearchSuggestion[]; total: number };
        setResults(json.products ?? []);
        setTotal(json.total ?? 0);
        setActive(-1);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  // Close when clicking outside.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setActive(-1);
    router.push(href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && optionCount) {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % optionCount);
    } else if (event.key === "ArrowUp" && optionCount) {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? optionCount - 1 : i - 1));
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (event.key === "Enter" && showPanel && results && active >= 0) {
      event.preventDefault();
      go(active < results.length ? `/product/${results[active]!.slug}` : searchHref);
    }
  };

  return (
    <form
      ref={containerRef}
      action="/search"
      method="get"
      role="search"
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) go(searchHref);
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Search products
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gold-dark" aria-hidden="true" />
        <input
          id={inputId}
          name="q"
          type="search"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={showPanel && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setOpen(true);
            if (value.trim().length < MIN_CHARS) {
              setResults(null);
              setLoading(false);
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-full border border-line bg-ivory/60 pl-11 pr-32 text-sm shadow-[inset_0_1px_2px_rgb(23_23_23/0.04)] transition placeholder:text-muted/80 hover:border-gold/60 focus:border-gold focus:bg-white focus:outline-none focus:ring-4 focus:ring-gold/15 lg:h-12 [&::-webkit-search-cancel-button]:hidden"
        />
        {loading ? <Spinner className="absolute right-[6.5rem] top-1/2 -translate-y-1/2 text-gold-dark" /> : null}
        <button
          type="submit"
          className="absolute right-1 top-1/2 inline-flex h-9 -translate-y-1/2 items-center rounded-full bg-ink px-5 text-sm font-medium text-ivory transition-colors hover:bg-ink-soft hover:text-gold-light lg:h-10"
        >
          Search
        </button>
      </div>

      {showPanel ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          {results === null ? (
            <p className="px-4 py-3 text-sm text-muted" role="status">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted" role="status">
              No products match “{trimmed}”.
            </p>
          ) : null}
          <ul id={listId} role="listbox" aria-label="Product suggestions" className={cn(!results?.length && "hidden")}>
            {results?.map((product, index) => (
              <li
                key={product.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={active === index}
                className={cn("flex cursor-pointer items-center gap-3 px-4 py-2.5", active === index ? "bg-ivory" : "hover:bg-ivory/60")}
                onPointerDown={(event) => event.preventDefault()}
                onPointerEnter={() => setActive(index)}
                onClick={() => go(`/product/${product.slug}`)}
              >
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-ivory">
                  {product.imageUrl ? <Image src={product.imageUrl} alt="" fill sizes="44px" className="object-cover" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-charcoal">{highlight(product.name, trimmed)}</span>
                  <span className="block truncate text-xs text-muted">
                    {product.brandName ?? ""}
                    {!product.inStock ? <span className="text-danger">{product.brandName ? " · " : ""}Out of stock</span> : null}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm">
                  {product.priceFrom ? <span className="block text-[10px] text-muted">From</span> : null}
                  <span className="font-semibold text-ink">{formatBDT(product.price)}</span>
                  {product.compareAt && product.compareAt > product.price ? (
                    <span className="block text-[11px] text-muted line-through">{formatBDT(product.compareAt)}</span>
                  ) : null}
                </span>
              </li>
            ))}
            {results?.length ? (
              <li
                id={`${listId}-${results.length}`}
                role="option"
                aria-selected={active === results.length}
                className={cn(
                  "flex cursor-pointer items-center justify-between border-t border-line px-4 py-3 text-sm font-medium text-gold-deep",
                  active === results.length ? "bg-ivory" : "hover:bg-ivory/60",
                )}
                onPointerDown={(event) => event.preventDefault()}
                onPointerEnter={() => setActive(results.length)}
                onClick={() => go(searchHref)}
              >
                See all {total} result{total === 1 ? "" : "s"} for “{trimmed}”
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
