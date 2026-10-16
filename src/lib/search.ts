/** A product suggestion returned by /api/search/suggest. Prices are in poisha. */
export type SearchSuggestion = {
  id: string;
  slug: string;
  name: string;
  brandName: string | null;
  imageUrl: string | null;
  price: number;
  compareAt: number | null;
  priceFrom: boolean;
  inStock: boolean;
};
