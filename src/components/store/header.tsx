import { Package, Phone, Search, ShoppingBag, Sparkles, User } from "lucide-react";
import Link from "next/link";
import type { StoreSettings } from "@/lib/settings-schema";
import { isStaffRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/server/auth/session";
import type { CategoryIndex } from "@/server/services/categories";
import { AccountMenu, MobileMenu, StickyHeader } from "./header-client";
import { HeaderActionIcon, HeaderActionText } from "./header-parts";
import type { Theme } from "@/lib/theme";
import { Logo } from "./logo";
import { MainNav } from "./main-nav";
import { SearchAutocomplete } from "./search-autocomplete";
import { FacebookIcon, InstagramIcon, LinkedinIcon, TiktokIcon, YoutubeIcon } from "./social-icons";
import { ThemeToggle } from "./theme-toggle";

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
  theme,
}: {
  settings: StoreSettings;
  nav: NavCategory[];
  user: CurrentUser | null;
  cartCount: number;
  theme: Theme;
}) {
  const cartLabel = `Shopping cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`;
  return (
    <StickyHeader>
      <div className="container-page flex h-[68px] items-center gap-2 sm:gap-3 lg:h-24 lg:gap-8">
        <MobileMenu
          nav={nav}
          user={user ? { name: user.name, isStaff: isStaffRole(user.role) } : null}
          phone={settings.general.contactPhone}
          theme={theme}
        />
        <Logo storeName={settings.general.storeName} logoUrl={settings.general.logoUrl || undefined} />

        <SearchAutocomplete className="mx-auto hidden w-full max-w-xl md:block" />

        <div className="ml-auto flex items-center gap-0.5 md:ml-0 lg:gap-5">
          <Link href="/search" className="group md:hidden" aria-label="Search">
            <HeaderActionIcon>
              <Search className="h-5 w-5" />
            </HeaderActionIcon>
          </Link>
          <ThemeToggle initial={theme} className="hidden md:block" />
          <Link href="/track-order" className="group hidden items-center gap-2.5 xl:flex">
            <HeaderActionIcon>
              <Package className="h-[18px] w-[18px]" />
            </HeaderActionIcon>
            <HeaderActionText top="Where’s my order?" bottom="Track order" />
          </Link>
          {user ? (
            <AccountMenu name={user.name} isStaff={isStaffRole(user.role)} />
          ) : (
            <Link href="/login" className="group flex items-center gap-2.5" aria-label="Sign in">
              <HeaderActionIcon>
                <User className="h-[18px] w-[18px]" />
              </HeaderActionIcon>
              <HeaderActionText top="Welcome" bottom="Sign in" />
            </Link>
          )}
          <Link href="/cart" className="group flex items-center gap-2.5" aria-label={cartLabel}>
            <HeaderActionIcon>
              <ShoppingBag className="h-[18px] w-[18px]" />
              {cartCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold px-1 text-[10px] font-bold text-onyx ring-2 ring-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : null}
            </HeaderActionIcon>
            <HeaderActionText top="My bag" bottom={`${cartCount} item${cartCount === 1 ? "" : "s"}`} />
          </Link>
        </div>
      </div>

      <MainNav nav={nav} />
      {/* Champagne hairline under the header. */}
      <div className="h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" aria-hidden="true" />
    </StickyHeader>
  );
}

export function AnnouncementBar({ settings }: { settings: StoreSettings }) {
  const { announcement, general, social } = settings;
  const hasMessage = announcement.enabled && Boolean(announcement.text);
  const phone = general.contactPhone;
  const socials = [
    { href: social.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: social.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: social.youtube, label: "YouTube", Icon: YoutubeIcon },
    { href: social.tiktok, label: "TikTok", Icon: TiktokIcon },
    { href: social.linkedin, label: "LinkedIn", Icon: LinkedinIcon },
  ].filter((s) => s.href);

  return (
    // Without a message there is nothing to show on phones; the hotline and links are desktop-only.
    <div className={cn("theme-light relative overflow-hidden bg-ink text-ivory/85", !hasMessage && "hidden lg:block")}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_120%_at_50%_50%,rgb(198_166_107/0.16),transparent_70%)]"
        aria-hidden="true"
      />
      <div className="container-page relative flex min-h-9 items-center justify-center gap-6 py-2 text-xs sm:min-h-10 sm:text-[13px] lg:justify-between">
        <div className="hidden min-w-0 flex-1 items-center gap-5 lg:flex">
          {phone ? (
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap transition-colors hover:text-gold">
              <Phone className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              {phone}
            </a>
          ) : null}
          {general.businessHours ? <span className="hidden truncate text-ivory/50 2xl:inline">{general.businessHours}</span> : null}
        </div>

        {hasMessage ? (
          <p className="text-center">
            <Sparkles className="mr-2 hidden h-3.5 w-3.5 align-[-2px] text-gold sm:inline" aria-hidden="true" />
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
        ) : null}

        <div className="hidden flex-1 items-center justify-end gap-5 lg:flex">
          <Link href="/track-order" className="transition-colors hover:text-gold">
            Track order
          </Link>
          <Link href="/contact" className="transition-colors hover:text-gold">
            Help &amp; contact
          </Link>
          {socials.length ? (
            <ul className="flex items-center gap-3 border-l border-ivory/15 pl-5">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="block text-ivory/70 transition-colors hover:text-gold">
                    <Icon className="h-3.5 w-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
