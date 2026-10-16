import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/store/catalog";
import { EmptyState } from "@/components/ui/feedback";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Brands", description: "Shop by brand at AKR Lifestyle." };

export default async function BrandsPage() {
  const brands = await prisma.brand.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, description: true, _count: { select: { products: { where: { status: "ACTIVE" } } } } },
  });
  return (
    <div className="container-page py-8 lg:py-12">
      <PageHeader breadcrumbs={[{ label: "Brands" }]} eyebrow="Shop by brand" title="Our brands" />
      {brands.length ? (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <li key={brand.id}>
              <Link href={`/brand/${brand.slug}`} className="card block h-full p-6 transition-colors hover:border-gold">
                <h2 className="text-2xl font-semibold">{brand.name}</h2>
                {brand.description ? <p className="mt-2 text-sm text-muted">{brand.description}</p> : null}
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-gold-dark">
                  {brand._count.products} product{brand._count.products === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-10" title="No brands yet" />
      )}
    </div>
  );
}
