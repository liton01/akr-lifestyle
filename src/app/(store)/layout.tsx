import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/store/footer";
import { AnnouncementBar, SiteHeader, buildNav } from "@/components/store/header";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { getCurrentUser } from "@/server/auth/session";
import { getCategoryIndex, getSettings } from "@/server/cache";
import { getCartOwner } from "@/server/cart-session";
import { prisma } from "@/server/db";
import { cartItemCount } from "@/server/services/cart";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [settings, categories, user] = await Promise.all([getSettings(), getCategoryIndex(), getCurrentUser()]);
  const owner = await getCartOwner();
  const count = await cartItemCount(prisma, owner);
  const nav = buildNav(categories);
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    // data-theme switches the colour tokens for the whole storefront (see globals.css); admin and print pages are unaffected.
    <div data-store-root data-theme={theme} className="flex min-h-screen flex-col bg-white text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory">
        Skip to content
      </a>
      <AnnouncementBar settings={settings} />
      <SiteHeader settings={settings} nav={nav} user={user} cartCount={count} theme={theme} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter settings={settings} nav={nav} />
    </div>
  );
}
