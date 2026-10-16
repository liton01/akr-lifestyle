"use client";

import { LayoutDashboard, LogOut, Menu, Package, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/server/actions/auth";
import type { NavCategory } from "./header";

export function MobileMenu({ nav, user }: { nav: NavCategory[]; user: { name: string; isStaff: boolean } | null }) {
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

  return (
    <>
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-full hover:bg-ivory lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-0 h-dvh max-h-dvh w-[min(22rem,88vw)] max-w-none bg-white p-0 backdrop:bg-ink/50"
        aria-label="Menu"
        onClick={closeOnNavigate}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-display text-xl font-semibold">Menu</span>
            <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-ivory" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form action="/search" method="get" role="search" className="border-b border-line p-4" onSubmit={() => setOpen(false)}>
            <label htmlFor="mobile-search" className="sr-only">
              Search products
            </label>
            <input
              id="mobile-search"
              name="q"
              type="search"
              placeholder="Search products"
              className="h-10 w-full rounded-full border border-line bg-ivory/50 px-4 text-sm focus:border-gold-dark focus:outline-none"
            />
          </form>
          <nav className="flex-1 overflow-y-auto p-2" aria-label="Mobile">
            <Link href="/shop" className="block rounded-md px-3 py-2.5 font-medium hover:bg-ivory">
              Shop all
            </Link>
            {nav.map((category) => (
              <details key={category.slug} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2.5 font-medium hover:bg-ivory">
                  {category.name}
                  <span className="text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="mb-2 ml-3 border-l border-line pl-3">
                  <Link href={`/category/${category.slug}`} className="block rounded-md px-3 py-2 text-sm text-gold-deep hover:bg-ivory">
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
            <Link href="/brands" className="block rounded-md px-3 py-2.5 font-medium hover:bg-ivory">
              Brands
            </Link>
            <Link href="/offers" className="block rounded-md px-3 py-2.5 font-semibold text-gold-deep hover:bg-ivory">
              Offers
            </Link>
            <hr className="my-2 border-line" />
            <Link href="/track-order" className="block rounded-md px-3 py-2.5 text-sm hover:bg-ivory">
              Track order
            </Link>
            <Link href="/contact" className="block rounded-md px-3 py-2.5 text-sm hover:bg-ivory">
              Contact us
            </Link>
          </nav>
          <div className="border-t border-line p-4">
            {user ? (
              <div className="space-y-2">
                <p className="text-sm text-muted">Signed in as {user.name}</p>
                <Link href="/account" className="block text-sm font-medium">
                  My account
                </Link>
                {user.isStaff ? (
                  <Link href="/admin" className="block text-sm font-medium">
                    Admin dashboard
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" className="flex-1 rounded-md bg-ink px-4 py-2 text-center text-sm font-medium text-ivory">
                  Sign in
                </Link>
                <Link href="/register" className="flex-1 rounded-md border border-ink px-4 py-2 text-center text-sm font-medium">
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

  return (
    <details ref={ref} className="relative">
      <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full hover:bg-ivory" aria-label="Account menu">
        <User className="h-5 w-5" />
      </summary>
      <div className="card absolute right-0 top-12 z-50 w-56 p-2">
        <p className="truncate px-3 py-2 text-xs text-muted">Hello, {name}</p>
        <Link href="/account" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-ivory">
          <User className="h-4 w-4" /> My account
        </Link>
        <Link href="/account/orders" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-ivory">
          <Package className="h-4 w-4" /> My orders
        </Link>
        {isStaff ? (
          <Link href="/admin" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-ivory">
            <LayoutDashboard className="h-4 w-4" /> Admin dashboard
          </Link>
        ) : null}
        <form action={signOutAction}>
          <button type="submit" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-ivory">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
