import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import type { ReactNode } from "react";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
import { getSettings } from "@/server/cache";
import { env } from "@/server/env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  // Static pages (e.g. the 404 page) are prerendered at build time; fall back to defaults
  // if the database is not reachable from the build environment.
  const settings = await getSettings().catch(() => DEFAULT_SETTINGS);
  const { seo, general } = settings;
  return {
    metadataBase: new URL(env().NEXT_PUBLIC_SITE_URL),
    title: { default: seo.defaultTitle, template: seo.titleTemplate },
    description: seo.defaultDescription,
    applicationName: general.storeName,
    icons: general.faviconUrl ? { icon: general.faviconUrl } : undefined,
    openGraph: {
      type: "website",
      siteName: general.storeName,
      title: seo.defaultTitle,
      description: seo.defaultDescription,
      images: seo.ogImageUrl ? [{ url: seo.ogImageUrl }] : undefined,
      locale: "en_BD",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#171717",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`} data-scroll-behavior="smooth">
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body> before
          React hydrates. This only ignores mismatches on <body>'s own attributes, not its children. */}
      <body className="min-h-screen bg-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
