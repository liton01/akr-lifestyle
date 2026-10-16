import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogView, PageHeader } from "@/components/store/catalog";
import { getCategoryIndex } from "@/server/cache";
import { prisma } from "@/server/db";

async function loadCategory(slug: string) {
  const index = await getCategoryIndex();
  const node = index.bySlug.get(slug);
  if (!node || !node.isActive) return null;
  // Every ancestor must be active as well.
  if (index.path(node.id).some((n) => !n.isActive)) return null;
  return { node, index };
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = await loadCategory(slug);
  if (!found) return { title: "Category not found" };
  const seo = await prisma.category.findUnique({ where: { id: found.node.id }, select: { seoTitle: true, seoDescription: true } });
  return {
    title: seo?.seoTitle || found.node.name,
    description: seo?.seoDescription || found.node.description || `Shop ${found.node.name} at AKR Lifestyle.`,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const found = await loadCategory(slug);
  if (!found) notFound();
  const { node, index } = found;
  const path = index.path(node.id);
  const children = index.childrenOf(node.id).filter((c) => c.isActive);

  return (
    <CatalogView
      basePath={`/category/${slug}`}
      searchParams={await searchParams}
      categoryId={node.id}
      emptyTitle={`No ${node.name.toLowerCase()} available right now`}
      header={
        <>
          <PageHeader
            breadcrumbs={path.map((p) => ({ label: p.name, href: `/category/${p.slug}` }))}
            eyebrow={path.length > 1 ? path[0]!.name : "Category"}
            title={node.name}
            description={node.description}
          />
          {children.length ? (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Subcategories">
              {children.map((child) => (
                <li key={child.id}>
                  <Link href={`/category/${child.slug}`} className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm hover:border-ink hover:bg-ivory">
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      }
    />
  );
}
