import { slugify } from "@/lib/utils";

/** Returns `base`, or `base-2`, `base-3`… — the first slug for which `taken` is false. */
export async function uniqueSlug(source: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(source) || "item";
  if (!(await taken(base))) return base;
  for (let i = 2; i < 500; i++) {
    const candidate = `${base}-${i}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
