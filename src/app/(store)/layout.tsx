import type { ReactNode } from "react";
import { SiteFooter } from "@/components/store/footer";
import { AnnouncementBar, SiteHeader, buildNav } from "@/components/store/header";
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

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory">
        Skip to content
      </a>
      <AnnouncementBar settings={settings} />
      <SiteHeader settings={settings} nav={nav} user={user} cartCount={count} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter settings={settings} nav={nav} />
    </div>
  );
}
