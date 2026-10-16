import { BadgeCheck, RotateCcw, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumbs } from "@/components/store/catalog";
import { ProductGrid } from "@/components/store/product-card";
import { ProductGallery, VariantPurchase } from "@/components/store/product-detail-client";
import { Badge } from "@/components/ui/feedback";
import { RichText } from "@/components/ui/rich-text";
import { fromMinor } from "@/lib/money";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { siteUrl } from "@/server/env";
import { getProductDetail, getRelatedProducts } from "@/server/services/storefront";

const loadProduct = cache((slug: string) => getProductDetail(prisma, slug));

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const product = await loadProduct((await params).slug);
  if (!product) return { title: "Product not found" };
  const description = product.seoDescription || product.shortDescription || product.description.slice(0, 160);
  return {
    title: product.seoTitle || product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { title: product.name, description, images: product.images[0] ? [{ url: product.images[0].url }] : undefined, type: "website" },
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([loadProduct(slug), getSettings()]);
  if (!product) notFound();
  const related = await getRelatedProducts(prisma, product);

  const prices = product.variants.map((v) => v.price.finalPrice);
  const inStock = product.variants.some((v) => v.stock > 0);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.shortDescription ?? product.description.slice(0, 300),
    image: product.images.map((i) => (i.url.startsWith("http") ? i.url : siteUrl(i.url))),
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "BDT",
      lowPrice: fromMinor(Math.min(...prices)),
      highPrice: fromMinor(Math.max(...prices)),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: siteUrl(`/product/${product.slug}`),
    },
  };

  return (
    <div className="container-page py-8 lg:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs
        items={[...product.categoryPath.map((c) => ({ label: c.name, href: `/category/${c.slug}` })), { label: product.name }]}
      />

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} name={product.name} />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.brand ? (
              <Link href={`/brand/${product.brand.slug}`} className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-dark hover:text-ink">
                {product.brand.name}
              </Link>
            ) : null}
            {product.isNewArrival ? <Badge>New</Badge> : null}
            {product.isBestSeller ? <Badge tone="dark">Best seller</Badge> : null}
          </div>
          <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">{product.name}</h1>
          {product.shortDescription ? <p className="mt-4 text-base leading-7 text-charcoal">{product.shortDescription}</p> : null}
          {product.saleEndsAt && product.variants.some((v) => v.price.discountSource === "SALE") ? (
            <p className="mt-3 text-sm font-medium text-gold-deep">
              Sale ends {product.saleEndsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: settings.general.timeZone })}
            </p>
          ) : null}

          <div className="mt-6 border-t border-line pt-6">
            <VariantPurchase
              productName={product.name}
              attributes={product.attributes}
              variants={product.variants}
              maxPerLine={settings.commerce.maxQuantityPerLine}
            />
          </div>

          <ul className="mt-8 grid gap-3 rounded-[var(--radius-card)] bg-ivory/70 p-5 text-sm">
            <li className="flex gap-3">
              <BadgeCheck className="h-5 w-5 shrink-0 text-gold-dark" aria-hidden="true" /> 100% authentic product with warranty where stated
            </li>
            <li className="flex gap-3">
              <Truck className="h-5 w-5 shrink-0 text-gold-dark" aria-hidden="true" /> Delivery across Bangladesh — charges shown at checkout
            </li>
            <li className="flex gap-3">
              <RotateCcw className="h-5 w-5 shrink-0 text-gold-dark" aria-hidden="true" />
              <span>
                {settings.commerce.returnWindowDays}-day returns on eligible items.{" "}
                <Link href="/return-policy" className="link">
                  Return policy
                </Link>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-16 grid gap-12 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="description-heading">
          <h2 id="description-heading" className="text-3xl font-semibold">
            Description
          </h2>
          <RichText content={product.description} className="mt-4" />
        </section>
        <section aria-labelledby="specs-heading">
          <h2 id="specs-heading" className="text-3xl font-semibold">
            Specifications
          </h2>
          <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
            {product.productType ? <SpecRow label="Type" value={product.productType} /> : null}
            {product.specifications.map((spec) => (
              <SpecRow key={spec.label} label={spec.label} value={spec.value} />
            ))}
            {product.weightGrams ? <SpecRow label="Weight" value={`${product.weightGrams} g`} /> : null}
            {product.dimensions ? <SpecRow label="Dimensions" value={product.dimensions} /> : null}
            <SpecRow label="SKU" value={product.sku} />
          </dl>
        </section>
      </div>

      {related.length ? (
        <section className="mt-20" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-3xl font-semibold">
            You may also like
          </h2>
          <div className="mt-8">
            <ProductGrid products={related} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-5 gap-4 py-3">
      <dt className="col-span-2 text-muted">{label}</dt>
      <dd className="col-span-3 text-ink">{value}</dd>
    </div>
  );
}
