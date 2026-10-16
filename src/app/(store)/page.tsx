import { ArrowRight, BadgeCheck, Banknote, RotateCcw, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ProductGrid } from "@/components/store/product-card";
import { ButtonLink } from "@/components/ui/button";
import { getActiveBrands, getCategoryIndex, getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { getActiveBanners } from "@/server/services/promotions";
import { getProductCards } from "@/server/services/storefront";
import { loadPricingContext } from "@/server/services/pricing";

const TRUST_ICONS = [BadgeCheck, Truck, Banknote, RotateCcw];

export default async function HomePage() {
  const [settings, categories, brands, ctx] = await Promise.all([getSettings(), getCategoryIndex(), getActiveBrands(), loadPricingContext(prisma)]);
  const [featured, newArrivals, bestSellers, promoBanners, stripBanners] = await Promise.all([
    getProductCards(prisma, { isFeatured: true }, 8, [{ updatedAt: "desc" }], ctx),
    getProductCards(prisma, { isNewArrival: true }, 8, [{ publishedAt: { sort: "desc", nulls: "last" } }], ctx),
    getProductCards(prisma, {}, 8, [{ isBestSeller: "desc" }, { soldCount: "desc" }], ctx),
    getActiveBanners(prisma, "HOME_PROMO"),
    getActiveBanners(prisma, "HOME_STRIP"),
  ]);
  const { homepage } = settings;
  const topCategories = categories.childrenOf(null).filter((c) => c.isActive);

  return (
    <>
      <section className="relative overflow-hidden bg-ink text-ivory">
        <div className="container-page grid items-center gap-10 py-14 md:grid-cols-2 md:py-20 lg:py-28">
          <div className="relative z-10">
            {homepage.heroEyebrow ? <p className="eyebrow text-gold">{homepage.heroEyebrow}</p> : null}
            <h1 className="mt-4 text-5xl font-semibold leading-[1.05] text-ivory sm:text-6xl lg:text-7xl">{homepage.heroTitle}</h1>
            {homepage.heroSubtitle ? <p className="mt-6 max-w-xl text-base leading-7 text-ivory/75 sm:text-lg">{homepage.heroSubtitle}</p> : null}
            <p className="mt-6 font-display text-xl italic text-gold">{settings.general.slogan}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {homepage.heroPrimaryCtaLabel && homepage.heroPrimaryCtaHref ? (
                <ButtonLink href={homepage.heroPrimaryCtaHref} variant="gold" size="lg">
                  {homepage.heroPrimaryCtaLabel}
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              ) : null}
              {homepage.heroSecondaryCtaLabel && homepage.heroSecondaryCtaHref ? (
                <ButtonLink href={homepage.heroSecondaryCtaHref} variant="outlineLight" size="lg">
                  {homepage.heroSecondaryCtaLabel}
                </ButtonLink>
              ) : null}
            </div>
          </div>
          {homepage.heroImageUrl ? (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl md:aspect-[5/4]">
              <Image
                src={homepage.heroImageUrl}
                alt=""
                fill
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : null}
        </div>
      </section>

      {homepage.trustPoints.length ? (
        <section aria-label="Why shop with us" className="border-b border-line bg-ivory/60">
          <ul className="container-page grid grid-cols-2 gap-6 py-8 lg:grid-cols-4">
            {homepage.trustPoints.map((point, index) => {
              const Icon = TRUST_ICONS[index % TRUST_ICONS.length]!;
              return (
                <li key={point.title} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-6 w-6 shrink-0 text-gold-dark" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{point.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted">{point.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {topCategories.length ? (
        <section className="container-page py-16">
          <SectionHeading eyebrow="Explore" title="Shop by category" href="/shop" linkLabel="Shop all" />
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {topCategories.map((category) => (
              <li key={category.id}>
                <Link href={`/category/${category.slug}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] bg-ivory">
                    {category.imageUrl ? (
                      <Image
                        src={category.imageUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <p className="mt-3 flex items-center justify-between font-medium">
                    {category.name}
                    <ArrowRight className="h-4 w-4 text-gold-dark transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {featured.length ? (
        <section className="container-page pb-16">
          <SectionHeading eyebrow="Curated" title={homepage.featuredTitle || "Featured"} href="/shop?sort=featured" linkLabel="View all" />
          <div className="mt-8">
            <ProductGrid products={featured} />
          </div>
        </section>
      ) : null}

      {promoBanners.length ? (
        <section className="container-page pb-16" aria-label="Promotions">
          <ul className="grid gap-4 md:grid-cols-3">
            {promoBanners.slice(0, 3).map((banner) => (
              <li key={banner.id}>
                <PromoTile banner={banner} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {newArrivals.length ? (
        <section className="container-page pb-16">
          <SectionHeading eyebrow="Just in" title={homepage.newArrivalsTitle || "New arrivals"} href="/shop?sort=newest" linkLabel="View all" />
          <div className="mt-8">
            <ProductGrid products={newArrivals} />
          </div>
        </section>
      ) : null}

      {stripBanners[0] ? (
        <section className="container-page pb-16" aria-label={stripBanners[0].title}>
          <StripBanner banner={stripBanners[0]} />
        </section>
      ) : null}

      {bestSellers.length ? (
        <section className="container-page pb-16">
          <SectionHeading eyebrow="Customer favourites" title={homepage.bestSellersTitle || "Best sellers"} href="/shop?sort=popular" linkLabel="View all" />
          <div className="mt-8">
            <ProductGrid products={bestSellers} />
          </div>
        </section>
      ) : null}

      {brands.length ? (
        <section className="border-y border-line bg-ivory/50">
          <div className="container-page py-12">
            <p className="eyebrow text-center">Our brands</p>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {brands.map((brand) => (
                <li key={brand.id}>
                  <Link href={`/brand/${brand.slug}`} className="font-display text-2xl font-semibold text-charcoal hover:text-gold-deep">
                    {brand.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}

function SectionHeading({ eyebrow, title, href, linkLabel }: { eyebrow: string; title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{title}</h2>
      </div>
      <Link href={href} className="hidden shrink-0 items-center gap-1 text-sm font-medium text-ink hover:text-gold-deep sm:inline-flex">
        {linkLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

type BannerData = { id: string; title: string; subtitle: string | null; imageUrl: string; linkUrl: string | null; ctaLabel: string | null };

function PromoTile({ banner }: { banner: BannerData }) {
  const content = (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-ink">
      <Image src={banner.imageUrl} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-ivory">
        <h3 className="text-2xl font-semibold">{banner.title}</h3>
        {banner.subtitle ? <p className="mt-1 text-sm text-ivory/80">{banner.subtitle}</p> : null}
        {banner.ctaLabel ? (
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold">
            {banner.ctaLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </div>
  );
  return banner.linkUrl ? <Link href={banner.linkUrl}>{content}</Link> : content;
}

function StripBanner({ banner }: { banner: BannerData }) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-ivory">
      <Image src={banner.imageUrl} alt="" fill sizes="100vw" className="object-cover" />
      <div className="relative flex flex-col gap-4 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12">
        <div>
          <h2 className="text-3xl font-semibold">{banner.title}</h2>
          {banner.subtitle ? <p className="mt-2 max-w-xl text-charcoal">{banner.subtitle}</p> : null}
        </div>
        {banner.linkUrl ? (
          <ButtonLink href={banner.linkUrl} variant="primary">
            {banner.ctaLabel || "Learn more"}
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}
