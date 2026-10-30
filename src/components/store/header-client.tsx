"use client";

import { ChevronDown, Headset, LayoutDashboard, LogOut, Menu, Package, Phone, Search, Sparkles, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";
import type { Theme } from "@/lib/theme";
import type { NavCategory } from "./header";
import { HeaderActionIcon, HeaderActionText } from "./header-parts";
import { ThemeSwitch } from "./theme-toggle";

function subscribeScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

/** Sticky header shell that gains a soft shadow once the page has scrolled. */
export function StickyHeader({ children }: { children: ReactNode }) {
  const scrolled = useSyncExternalStore(subscribeScroll, () => window.scrollY > 8, () => false);
  return (
    <header
      className={cn(
        "theme-light sticky top-0 z-40 bg-ink text-ivory backdrop-blur transition-shadow duration-300 supports-[backdrop-filter]:bg-ink/95",
        scrolled && "shadow-[0_12px_32px_-20px_rgb(23_23_23/0.45)]",
      )}
    >
      {children}
    </header>
  );
}

export function MobileMenu({ nav, user, phone, theme }: { nav: NavCategory[]; user: { name: string; isStaff: boolean } | null; phone: string; theme: Theme }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  // Close the menu when a link inside it is followed or the search is submitted.
  const closeOnNavigate = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  };

  const rowClass = "flex items-center justify-between rounded-lg px-3 py-3 font-medium text-ink hover:bg-ivory";
  const utilityClass = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-charcoal hover:bg-ivory hover:text-ink";

  return (
    <>
      <button type="button" className="group lg:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <HeaderActionIcon>
          <Menu className="h-5 w-5" />
        </HeaderActionIcon>
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-0 h-dvh max-h-dvh w-[min(22rem,88vw)] max-w-none bg-white p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        aria-label="Menu"
        onClick={closeOnNavigate}
      >
        <div className="flex h-full flex-col">
          <div className="theme-light relative bg-ink px-5 pb-5 pt-4 text-ivory">
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl font-semibold tracking-wide">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-ivory/20 transition-colors hover:border-gold hover:text-gold"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form action="/search" method="get" role="search" className="mt-4" onSubmit={() => setOpen(false)}>
              <label htmlFor="mobile-search" className="sr-only">
                Search products
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ivory/50" aria-hidden="true" />
                <input
                  id="mobile-search"
                  name="q"
                  type="search"
                  placeholder="Search products"
                  className="h-11 w-full rounded-full border border-ivory/15 bg-ivory/10 pl-10 pr-4 text-sm text-ivory placeholder:text-ivory/50 focus:border-gold focus:outline-none"
                />
              </div>
            </form>
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" aria-hidden="true" />
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Mobile">
            <Link href="/shop" className={rowClass}>
              Shop all
            </Link>
            {nav.map((category) => (
              <details key={category.slug} className="group">
                <summary className={cn(rowClass, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
                  {category.name}
                  <ChevronDown className="h-4 w-4 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="mb-2 ml-4 border-l-2 border-gold/40 pl-3">
                  <Link href={`/category/${category.slug}`} className="block rounded-md px-3 py-2 text-sm font-medium text-gold-deep hover:bg-ivory">
                    All {category.name}
                  </Link>
                  {category.children.map((child) => (
                    <Link key={child.slug} href={`/category/${child.slug}`} className="block rounded-md px-3 py-2 text-sm text-charcoal hover:bg-ivory">
                      {child.name}
                    </Link>
                  ))}
                </div>
              </details>
            ))}
            <Link href="/brands" className={rowClass}>
              Brands
            </Link>
            <Link
              href="/offers"
              className="theme-light mt-2 flex items-center gap-2 rounded-lg bg-ivory bg-gradient-to-r from-gold-light/70 to-gold/40 px-3 py-3 font-semibold text-ink"
            >
              <Sparkles className="h-4 w-4 text-gold-deep" aria-hidden="true" />
              Offers
            </Link>
            <hr className="my-3 border-line" />
            <Link href="/track-order" className={utilityClass}>
              <Package className="h-4 w-4 text-gold-dark" aria-hidden="true" />
              Track order
            </Link>
            <Link href="/contact" className={utilityClass}>
              <Headset className="h-4 w-4 text-gold-dark" aria-hidden="true" />
              Help &amp; contact
            </Link>
            {phone ? (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={utilityClass}>
                <Phone className="h-4 w-4 text-gold-dark" aria-hidden="true" />
                {phone}
              </a>
            ) : null}
            <ThemeSwitch initial={theme} />
          </nav>

          <div className="border-t border-line bg-ivory/60 p-4">
            {user ? (
              <div className="space-y-2">
                <p className="text-sm text-muted">
                  Signed in as <span className="font-medium text-ink">{user.name}</span>
                </p>
                <div className="flex gap-2">
                  <Link href="/account" className="flex-1 rounded-full bg-ink px-4 py-2.5 text-center text-sm font-medium text-ivory">
                    My account
                  </Link>
                  {user.isStaff ? (
                    <Link href="/admin" className="flex-1 rounded-full border border-ink px-4 py-2.5 text-center text-sm font-medium">
                      Admin
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" className="flex-1 rounded-full bg-ink px-4 py-2.5 text-center text-sm font-medium text-ivory">
                  Sign in
                </Link>
                <Link href="/register" className="flex-1 rounded-full border border-ink px-4 py-2.5 text-center text-sm font-medium">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

export function AccountMenu({ name, isStaff }: { name: string; isStaff: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const firstName = name.trim().split(/\s+/)[0] || name;
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [pathname]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.removeAttribute("open");
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") ref.current?.removeAttribute("open");
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const itemClass = "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-charcoal hover:bg-ivory hover:text-ink";

  return (
    <details ref={ref} className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden" aria-label="Account menu">
        <HeaderActionIcon dark>
          <User className="h-[18px] w-[18px]" />
        </HeaderActionIcon>
        <HeaderActionText
          top={`Hello, ${firstName}`}
          bottom={
            <span className="inline-flex items-center gap-1">
              My account
              <ChevronDown className="h-3.5 w-3.5 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
          }
          dark
        />
      </summary>
      <div className="card absolute right-0 top-full z-50 mt-3 w-60 overflow-hidden">
        <div className="theme-light bg-ink px-4 py-3 text-ivory">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Signed in</p>
          <p className="truncate font-display text-lg">{name}</p>
        </div>
        <div className="p-2">
          <Link href="/account" className={itemClass}>
            <User className="h-4 w-4 text-gold-dark" /> My account
          </Link>
          <Link href="/account/orders" className={itemClass}>
            <Package className="h-4 w-4 text-gold-dark" /> My orders
          </Link>
          {isStaff ? (
            <Link href="/admin" className={itemClass}>
              <LayoutDashboard className="h-4 w-4 text-gold-dark" /> Admin dashboard
            </Link>
          ) : null}
          <form action={signOutAction} className="mt-1 border-t border-line pt-1">
            <button type="submit" className={cn(itemClass, "w-full text-left")}>
              <LogOut className="h-4 w-4 text-gold-dark" /> Sign out
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}
