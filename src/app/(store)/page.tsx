import { ArrowRight, BadgeCheck, Banknote, CreditCard, Package, RotateCcw, ShoppingBag, Sparkles, Tags, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { HeroSlider } from "@/components/store/hero-slider";
import { ProductGrid } from "@/components/store/product-card";
import { ButtonLink } from "@/components/ui/button";
import { getActiveBrands, getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { getActiveBanners } from "@/server/services/promotions";
import { getProductCards } from "@/server/services/storefront";
import { loadPricingContext } from "@/server/services/pricing";

const TRUST_ICONS = [BadgeCheck, Truck, Banknote, RotateCcw];
const CATEGORY_SHORTCUTS = [
  { label: "Bags", href: "/category/bags-wallets", Icon: ShoppingBag },
  { label: "Wallets", href: "/category/bags-wallets", Icon: CreditCard },
  { label: "Backpacks", href: "/search?q=backpack", Icon: Package },
  { label: "Travel", href: "/search?q=travel", Icon: Truck },
  { label: "Accessories", href: "/category/lifestyle-accessories", Icon: Sparkles },
  { label: "Brands", href: "/brands", Icon: Tags },
];

export default async function HomePage() {
  const [settings, brands, ctx] = await Promise.all([getSettings(), getActiveBrands(), loadPricingContext(prisma)]);
  const [featured, newArrivals, bestSellers, promoBanners, stripBanners, heroSlides] = await Promise.all([
    getProductCards(prisma, { isFeatured: true }, 8, [{ updatedAt: "desc" }], ctx),
    getProductCards(prisma, { isNewArrival: true }, 8, [{ publishedAt: { sort: "desc", nulls: "last" } }], ctx),
    getProductCards(prisma, {}, 8, [{ isBestSeller: "desc" }, { soldCount: "desc" }], ctx),
    getActiveBanners(prisma, "HOME_PROMO"),
    getActiveBanners(prisma, "HOME_STRIP"),
    getActiveBanners(prisma, "HOME_HERO"),
  ]);
  const { homepage } = settings;

  return (
    <>
      {heroSlides.length ? (
        <>
          <h1 className="sr-only">
            {settings.general.storeName} — {settings.general.slogan}
          </h1>
          <HeroSlider
            slides={heroSlides.map((b) => ({
              id: b.id,
              eyebrow: b.eyebrow,
              title: b.title,
              subtitle: b.subtitle,
              imageUrl: b.imageUrl,
              mobileImageUrl: b.mobileImageUrl,
              linkUrl: b.linkUrl,
              ctaLabel: b.ctaLabel,
              secondaryCtaLabel: b.secondaryCtaLabel,
              secondaryLinkUrl: b.secondaryLinkUrl,
              textTone: b.textTone,
            }))}
          />
        </>
      ) : (
      <section className="theme-light relative overflow-hidden bg-ink text-ivory">
        <div className="container-page grid items-center gap-10 py-14 md:grid-cols-2 md:py-20 lg:min-h-[620px] lg:py-24">
          <div className="relative z-10">
            {homepage.heroEyebrow ? <p className="eyebrow text-gold">{homepage.heroEyebrow}</p> : null}
            <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-ivory sm:text-6xl lg:text-7xl">{homepage.heroTitle}</h1>
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
      )}

      <section aria-label="Shop by category" className="theme-light bg-ink py-3 text-ivory sm:py-4">
        <ul className="container-page grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
          {CATEGORY_SHORTCUTS.map(({ label, href, Icon }) => (
            <li key={label}>
              <Link href={href} className="group flex min-h-24 flex-col items-center justify-center border border-ivory/15 bg-[radial-gradient(ellipse_at_50%_120%,rgb(198_166_107/0.14),transparent_70%),linear-gradient(145deg,#242321,#111)] px-2 py-3 text-center transition hover:border-gold/60 hover:bg-ink-soft sm:min-h-32 sm:py-4">
                <Icon className="h-6 w-6 text-gold transition-transform group-hover:-translate-y-0.5 sm:h-8 sm:w-8" strokeWidth={1.4} aria-hidden="true" />
                <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] sm:mt-3 sm:text-xs">{label}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-gold sm:text-[11px]">Shop now <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {promoBanners.length ? (
        <section className="container-page pb-16" aria-label="Featured collections">
          <SectionHeading eyebrow="Featured collections" title="The AKR collection" href="/shop" linkLabel="Explore all" />
          <ul className="grid gap-2 md:grid-cols-5">
            {promoBanners.slice(0, 2).map((banner, index) => (
              <li key={banner.id} className={index === 0 ? "md:col-span-3" : "md:col-span-2"}>
                <PromoTile banner={banner} featured={index === 0} />
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
            <ProductGrid products={bestSellers.slice(0, 6)} sixColumns />
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

      {homepage.trustPoints.length ? (
        <section aria-label="Why shop with us" className="theme-light border-t border-ivory/15 bg-ink text-ivory">
          <ul className="container-page grid grid-cols-2 gap-6 py-8 lg:grid-cols-4">
            {homepage.trustPoints.map((point, index) => {
              const Icon = TRUST_ICONS[index % TRUST_ICONS.length]!;
              return (
                <li key={point.title} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-6 w-6 shrink-0 text-gold" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-ivory">{point.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-ivory/60">{point.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
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

function PromoTile({ banner, featured }: { banner: BannerData; featured: boolean }) {
  const content = (
    <div className={`theme-light group relative overflow-hidden bg-ink ${featured ? "aspect-[4/3] md:aspect-[3/1]" : "aspect-[4/3] md:aspect-[2/1]"}`}>
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
    <div className="relative min-h-[260px] overflow-hidden bg-ivory sm:min-h-[320px]">
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
