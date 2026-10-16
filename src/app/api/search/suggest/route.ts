import type { SearchSuggestion } from "@/lib/search";
import { prisma } from "@/server/db";
import { hitRateLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { searchCatalog } from "@/server/services/storefront";

/**
 * Type-ahead product suggestions for the search box. Uses the same catalogue search
 * (name, SKU, brand, category, type, description) and live pricing as the search page.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ products: [], total: 0 });

  const limit = await hitRateLimit(prisma, `suggest:${await clientIp()}`, 120, 60);
  if (!limit.allowed) return Response.json({ products: [], total: 0, error: "Too many searches. Please slow down." }, { status: 429 });

  const { products, total } = await searchCatalog(prisma, { q, page: 1, pageSize: 6, sort: "popular" });
  const body: { products: SearchSuggestion[]; total: number } = {
    total,
    products: products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brandName: p.brandName,
      imageUrl: p.imageUrl,
      price: p.price.finalPrice,
      compareAt: p.price.displayCompareAt,
      priceFrom: p.priceFrom,
      inStock: p.inStock,
    })),
  };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
