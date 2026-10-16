"use client";

import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import type { NavCategory } from "./header";

/** Category links: uppercase and letter-spaced on wide screens, with a gold underline that draws in on hover. */
const navLinkClass =
  "relative inline-flex items-center gap-1 py-1 font-medium text-charcoal transition-colors hover:text-ink xl:text-[13px] xl:uppercase xl:tracking-[0.12em] " +
  "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[1.5px] after:origin-left after:scale-x-0 after:bg-gold after:transition-transform after:duration-300 " +
  "hover:after:scale-x-100 focus-visible:after:scale-x-100";

/**
 * Desktop category bar. A category's dropdown opens on hover or keyboard focus and closes when
 * the pointer or focus leaves, on Escape, and as soon as any link inside it is clicked — so it
 * never lingers over the page you just opened. The open state is tied to the current path, so
 * any navigation also closes it.
 */
export function MainNav({ nav }: { nav: NavCategory[] }) {
  const pathname = usePathname();
  const [openState, setOpenState] = useState<{ slug: string; path: string } | null>(null);
  const openSlug = openState?.path === pathname ? openState.slug : null;
  const open = (slug: string) => setOpenState({ slug, path: pathname });
  const close = () => setOpenState(null);

  return (
    <nav aria-label="Main" className="relative hidden border-t border-line/60 lg:block">
      <ul className="container-page flex h-12 items-center gap-6 text-sm xl:gap-8">
        {/* "Shop all" leads the bar in the same type as the categories, set apart by a gold diamond and a hairline. */}
        <li className="flex h-full items-center border-r border-line pr-6 xl:pr-8">
          <Link href="/shop" className={cn(navLinkClass, "gap-2.5 font-semibold text-ink")}>
            <span className="h-[7px] w-[7px] rotate-45 bg-gradient-to-br from-gold-light to-gold-dark" aria-hidden="true" />
            Shop all
          </Link>
        </li>
        {nav.map((category) => {
          const hasPanel = category.children.length > 0;
          const isOpen = hasPanel && openSlug === category.slug;
          return (
            <li
              key={category.slug}
              className="flex h-full items-center"
              onPointerEnter={(event) => {
                if (hasPanel && event.pointerType === "mouse") open(category.slug);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") close();
              }}
              onFocus={() => {
                if (hasPanel) open(category.slug);
              }}
              onBlur={(event: FocusEvent<HTMLLIElement>) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
              }}
              onKeyDown={(event: KeyboardEvent<HTMLLIElement>) => {
                if (event.key === "Escape" && isOpen) {
                  close();
                  event.currentTarget.querySelector<HTMLAnchorElement>("a")?.focus();
                }
              }}
              onClick={(event: MouseEvent<HTMLLIElement>) => {
                if ((event.target as HTMLElement).closest("a")) close();
              }}
            >
              <Link
                href={`/category/${category.slug}`}
                className={cn(navLinkClass, isOpen && "text-ink after:scale-x-100")}
                aria-haspopup={hasPanel ? "true" : undefined}
                aria-expanded={hasPanel ? isOpen : undefined}
              >
                {category.name}
                {hasPanel ? (
                  <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform duration-300", isOpen && "rotate-180")} aria-hidden="true" />
                ) : null}
              </Link>
              {hasPanel ? <MegaPanel category={category} open={isOpen} /> : null}
            </li>
          );
        })}
        <li>
          <Link href="/brands" className={navLinkClass}>
            Brands
          </Link>
        </li>
        <li className="ml-auto">
          <Link
            href="/offers"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-r from-gold-light via-gold to-gold-dark px-4 text-[13px] font-semibold text-ink shadow-[0_6px_16px_-8px_rgb(125_101_53/0.9)] transition hover:brightness-105"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Offers
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/** Full-width dropdown for a top-level category, anchored to the nav bar so it never runs off-screen. */
function MegaPanel({ category, open }: { category: NavCategory; open: boolean }) {
  const count = category.children.length;
  return (
    <div
      className={cn(
        "absolute inset-x-0 top-full z-50 transition-[opacity,transform,visibility] duration-200",
        open ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-1 opacity-0",
      )}
    >
      <div className="border-y border-line bg-white shadow-[0_24px_48px_-24px_rgb(23_23_23/0.28)]">
        <div className="container-page grid grid-cols-12 gap-8 py-8">
          <div className="col-span-3">
            <p className="eyebrow">Collection</p>
            <p className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">{category.name}</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Browse {count} {count === 1 ? "range" : "ranges"} in {category.name.toLowerCase()}.
            </p>
            <Link
              href={`/category/${category.slug}`}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gold-deep transition-colors hover:text-ink"
            >
              View all {category.name}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="col-span-6 grid grid-cols-2 content-start gap-x-6 gap-y-1 border-l border-line pl-8">
            {category.children.map((child) => (
              <li key={child.slug}>
                <Link
                  href={`/category/${child.slug}`}
                  className="group/link flex items-center justify-between rounded-lg px-3 py-2.5 text-[15px] text-charcoal transition-colors hover:bg-ivory hover:text-ink"
                >
                  {child.name}
                  <ArrowRight
                    className="h-4 w-4 -translate-x-1 text-gold-dark opacity-0 transition duration-200 group-hover/link:translate-x-0 group-hover/link:opacity-100"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`/category/${category.slug}?sort=newest`}
            className="group/feature relative col-span-3 flex min-h-44 flex-col justify-end overflow-hidden rounded-2xl bg-ink p-6 text-ivory"
          >
            {/* Decorative gold rings, echoing the hero artwork. */}
            <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full border border-gold/30" aria-hidden="true" />
            <span className="absolute -right-2 -top-2 h-24 w-24 rounded-full border border-gold/50 transition-transform duration-500 group-hover/feature:scale-110" aria-hidden="true" />
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgb(198_166_107/0.28),transparent_55%)]" aria-hidden="true" />
            <span className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Just landed</span>
            <span className="relative mt-1 font-display text-2xl font-semibold leading-tight">New in {category.name}</span>
            <span className="relative mt-3 inline-flex items-center gap-1.5 text-sm text-ivory/80 transition-colors group-hover/feature:text-gold">
              Shop the latest
              <ArrowRight className="h-4 w-4 transition-transform group-hover/feature:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
