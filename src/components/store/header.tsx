import { ChevronDown, Search, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import type { StoreSettings } from "@/lib/settings-schema";
import { isStaffRole } from "@/lib/permissions";
import type { CurrentUser } from "@/server/auth/session";
import type { CategoryIndex } from "@/server/services/categories";
import { AccountMenu, MobileMenu } from "./header-client";
import { Logo } from "./logo";
import { SearchAutocomplete } from "./search-autocomplete";

export type NavCategory = { name: string; slug: string; children: { name: string; slug: string }[] };

export function buildNav(index: CategoryIndex): NavCategory[] {
  return index
    .childrenOf(null)
    .filter((c) => c.isActive)
    .map((c) => ({
      name: c.name,
      slug: c.slug,
      children: index
        .childrenOf(c.id)
        .filter((child) => child.isActive)
        .map((child) => ({ name: child.name, slug: child.slug })),
    }));
}

export function SiteHeader({
  settings,
  nav,
  user,
  cartCount,
}: {
  settings: StoreSettings;
  nav: NavCategory[];
  user: CurrentUser | null;
  cartCount: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="container-page flex h-16 items-center gap-3 lg:h-20">
        <MobileMenu nav={nav} user={user ? { name: user.name, isStaff: isStaffRole(user.role) } : null} />
        <Logo storeName={settings.general.storeName} logoUrl={settings.general.logoUrl || undefined} />

        <SearchAutocomplete className="mx-auto hidden w-full max-w-md md:block" />

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link href="/search" className="grid h-10 w-10 place-items-center rounded-full hover:bg-ivory md:hidden" aria-label="Search">
            <Search className="h-5 w-5" />
          </Link>
          {user ? (
            <AccountMenu name={user.name} isStaff={isStaffRole(user.role)} />
          ) : (
            <Link href="/login" className="grid h-10 w-10 place-items-center rounded-full hover:bg-ivory" aria-label="Sign in">
              <User className="h-5 w-5" />
            </Link>
          )}
          <Link
            href="/cart"
            className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-ivory"
            aria-label={`Shopping cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
          >
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 ? (
              <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-ink">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      <nav aria-label="Main" className="hidden border-t border-line/70 lg:block">
        <ul className="container-page flex h-11 items-center gap-7 text-sm">
          <li>
            <Link href="/shop" className="font-medium text-ink hover:text-gold-deep">
              Shop all
            </Link>
          </li>
          {nav.map((category) => (
            <li key={category.slug} className="group relative">
              <Link
                href={`/category/${category.slug}`}
                className="inline-flex items-center gap-1 font-medium text-ink hover:text-gold-deep"
                aria-haspopup={category.children.length ? "true" : undefined}
              >
                {category.name}
                {category.children.length ? <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden="true" /> : null}
              </Link>
              {category.children.length ? (
                <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <ul className="card min-w-56 p-2">
                    {category.children.map((child) => (
                      <li key={child.slug}>
                        <Link href={`/category/${child.slug}`} className="block rounded-md px-3 py-2 text-sm text-charcoal hover:bg-ivory hover:text-ink">
                          {child.name}
                        </Link>
                      </li>
                    ))}
                    <li className="mt-1 border-t border-line pt-1">
                      <Link href={`/category/${category.slug}`} className="block rounded-md px-3 py-2 text-sm font-medium text-gold-deep hover:bg-ivory">
                        View all {category.name}
                      </Link>
                    </li>
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
          <li>
            <Link href="/brands" className="font-medium text-ink hover:text-gold-deep">
              Brands
            </Link>
          </li>
          <li className="ml-auto">
            <Link href="/offers" className="font-semibold text-gold-deep hover:text-ink">
              Offers
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export function AnnouncementBar({ settings }: { settings: StoreSettings }) {
  const { announcement } = settings;
  if (!announcement.enabled || !announcement.text) return null;
  return (
    <div className="bg-ink text-center text-xs text-ivory sm:text-sm">
      <p className="container-page py-2">
        {announcement.text}
        {announcement.linkUrl ? (
          <>
            {" "}
            <Link href={announcement.linkUrl} className="font-semibold text-gold underline-offset-4 hover:underline">
              {announcement.linkLabel || "Learn more"}
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
