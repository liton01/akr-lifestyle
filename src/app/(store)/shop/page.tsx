import type { Metadata } from "next";
import { CatalogView, PageHeader } from "@/components/store/catalog";

export const metadata: Metadata = {
  title: "Shop all products",
  description: "Browse electronics, gadgets, watches, jewellery and lifestyle accessories.",
};

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <CatalogView
      basePath="/shop"
      searchParams={await searchParams}
      header={<PageHeader breadcrumbs={[{ label: "Shop" }]} eyebrow="The collection" title="Shop all products" />}
    />
  );
}
