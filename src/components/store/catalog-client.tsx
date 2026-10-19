"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useTransition, type ReactNode } from "react";
import { Spinner } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

/** How long the price boxes wait after the last keystroke before filtering. */
const PRICE_DEBOUNCE_MS = 700;

type CatalogNavigation = { pending: boolean; navigate: (href: string) => void };

const CatalogContext = createContext<CatalogNavigation | null>(null);

/**
 * Shares one transition between the filters, the sort menu and the results, so the grid can fade
 * while a new set of products loads. Navigations are client-side and keep the scroll position.
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => {
      startTransition(() => router.push(href, { scroll: false }));
    },
    [router],
  );
  const value = useMemo(() => ({ pending, navigate }), [pending, navigate]);
  return <CatalogContext value={value}>{children}</CatalogContext>;
}

/** Builds the GET URL a form would submit to, leaving out empty fields. */
function formHref(form: HTMLFormElement) {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form)) {
    if (typeof value === "string" && value.trim()) params.append(key, value.trim());
  }
  const action = form.getAttribute("action") || window.location.pathname;
  const query = params.toString();
  return query ? `${action}?${query}` : action;
}

/**
 * Product filter form that applies itself: checkboxes filter as soon as they are clicked, the
 * price boxes once typing pauses (or on Enter). Without JavaScript it still works as a normal
 * GET form through its fallback submit button.
 *
 * The inputs stay uncontrolled so typing is never interrupted; when the URL changes from
 * elsewhere (a removed filter tag, "Clear all", the back button) they are re-synced from it.
 */
export function AutoFilterForm({ action, label, className, children }: { action: string; label: string; className?: string; children: ReactNode }) {
  const catalog = use(CatalogContext);
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const pending = catalog?.pending ?? false;

  const apply = useCallback(() => {
    window.clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;
    if (catalog) catalog.navigate(formHref(form));
    else form.submit();
  }, [catalog]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    // Wait for in-flight filtering to settle, so quick successive clicks never flicker back.
    const form = formRef.current;
    if (pending || !form) return;
    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement) || !element.name || element.type === "hidden") continue;
      if (element.type === "checkbox") element.checked = searchParams.getAll(element.name).includes(element.value);
      else if (element !== document.activeElement) element.value = searchParams.get(element.name) ?? "";
    }
  }, [searchParams, pending]);

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      aria-label={label}
      className={className}
      onChange={(event) => {
        const target: EventTarget = event.target;
        if (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio")) {
          apply();
        } else {
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(apply, PRICE_DEBOUNCE_MS);
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      {children}
    </form>
  );
}

/** Wraps the product grid; fades it and marks it busy while new results load. */
export function CatalogResults({ children }: { children: ReactNode }) {
  const pending = use(CatalogContext)?.pending ?? false;
  return (
    <div aria-busy={pending} className={cn("transition-opacity duration-200", pending && "pointer-events-none opacity-50")}>
      {children}
    </div>
  );
}

/** Small "Updating…" spinner shown next to the result count while filtering. */
export function CatalogPending() {
  const pending = use(CatalogContext)?.pending ?? false;
  if (!pending) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <Spinner className="text-gold-dark" />
      Updating…
    </span>
  );
}

/** A <select> that applies its form as soon as the value changes. */
export function AutoSubmitSelect({
  id,
  name,
  defaultValue,
  options,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  const catalog = use(CatalogContext);
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      onChange={(event) => {
        const form = event.currentTarget.form;
        if (!form) return;
        if (catalog) catalog.navigate(formHref(form));
        else form.requestSubmit();
      }}
      className="h-9 rounded-md border border-line bg-white px-2 text-sm focus:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold/30"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
