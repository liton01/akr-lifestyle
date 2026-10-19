import type { Metadata } from "next";
import Image from "next/image";
import { CatalogView, PageHeader } from "@/components/store/catalog";
import { prisma } from "@/server/db";
import { loadLiveDiscounts } from "@/server/services/pricing";
import { getActiveBanners } from "@/server/services/promotions";

export const metadata: Metadata = { title: "Special offers", description: "Current sales and promotions at AKR Lifestyle." };

export default async function OffersPage({ searchParams }: PageProps<"/offers">) {
  const now = new Date();
  const [banners, promotions] = await Promise.all([getActiveBanners(prisma, "OFFERS_PAGE", now), loadLiveDiscounts(prisma, now)]);
  const banner = banners[0];
  return (
    <CatalogView
      basePath="/offers"
      searchParams={await searchParams}
      forceOnSale
      emptyTitle="No offers right now"
      emptyDescription="New promotions are added regularly — check back soon."
      header={
        <>
          <PageHeader breadcrumbs={[{ label: "Offers" }]} eyebrow="Limited time" title="Special offers" description="Sale prices and promotions, applied automatically at checkout." />
          {banner ? (
            <div className="theme-light relative mt-8 aspect-[3/1] overflow-hidden rounded-[var(--radius-card)] bg-ink">
              <Image src={banner.imageUrl} alt="" fill sizes="100vw" className="object-cover" priority />
              <div className="absolute inset-0 flex flex-col justify-center p-6 text-ivory sm:p-12">
                <h2 className="text-3xl font-semibold sm:text-4xl">{banner.title}</h2>
                {banner.subtitle ? <p className="mt-2 max-w-lg text-sm text-ivory/80 sm:text-base">{banner.subtitle}</p> : null}
              </div>
            </div>
          ) : null}
          {promotions.length ? (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Active promotions">
              {promotions.map((promo) => (
                <li key={promo.id} className="rounded-full bg-gold/15 px-4 py-1.5 text-sm text-gold-deep">
                  <span className="font-semibold">{promo.name}</span>
                  {promo.endsAt ? <span className="text-gold-deep/80"> · ends {promo.endsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" })}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      }
    />
  );
}
