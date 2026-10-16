"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Spinner } from "@/components/ui/feedback";

const DEBOUNCE_MS = 350;

/**
 * Search-page input that refreshes the results while the customer types. It updates the
 * `q` query parameter (keeping filters and sort, resetting the page), so results stay
 * shareable and the back button works. Enter still submits the surrounding form.
 */
export function LiveSearchInput({ id, defaultValue }: { id: string; defaultValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const q = value.trim();
    if (q === (searchParams.get("q") ?? "").trim()) return;
    if (q.length === 1) return; // wait for at least two characters
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      params.delete("page");
      const query = params.toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, searchParams, pathname, router]);

  return (
    <div className="relative flex-1">
      <input
        id={id}
        name="q"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by name, brand or SKU"
        autoComplete="off"
        className="h-11 w-full rounded-md border border-line px-4 pr-10 text-sm focus:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold/30"
      />
      {pending ? <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 text-gold-dark" /> : null}
    </div>
  );
}
