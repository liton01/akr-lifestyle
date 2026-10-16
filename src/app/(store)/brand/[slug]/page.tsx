import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView, PageHeader } from "@/components/store/catalog";
import { prisma } from "@/server/db";

async function loadBrand(slug: string) {
  return prisma.brand.findFirst({ where: { slug, isActive: true }, select: { id: true, name: true, description: true } });
}

export async function generateMetadata({ params }: PageProps<"/brand/[slug]">): Promise<Metadata> {
  const brand = await loadBrand((await params).slug);
  return brand ? { title: brand.name, description: brand.description ?? `Shop ${brand.name} at AKR Lifestyle.` } : { title: "Brand not found" };
}

export default async function BrandPage({ params, searchParams }: PageProps<"/brand/[slug]">) {
  const { slug } = await params;
  const brand = await loadBrand(slug);
  if (!brand) notFound();
  return (
    <CatalogView
      basePath={`/brand/${slug}`}
      searchParams={await searchParams}
      fixedBrandId={brand.id}
      header={
        <PageHeader
          breadcrumbs={[{ label: "Brands", href: "/brands" }, { label: brand.name }]}
          eyebrow="Brand"
          title={brand.name}
          description={brand.description}
        />
      }
    />
  );
}
