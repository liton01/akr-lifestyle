"use client";

import { Plus, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { GalleryEditor, type UploadedImage } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, FieldError, Input, Label, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionResult } from "@/lib/action-result";
import { cn, slugify } from "@/lib/utils";
import { saveProductAction } from "@/server/actions/admin/catalog";
import type { ProductFormValues } from "@/server/services/products";

export type AttributeOption = { id: string; name: string; values: { id: string; value: string }[] };
export type CategoryOption = { id: string; name: string; depth: number };

type Variant = ProductFormValues["variants"][number];

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export const EMPTY_PRODUCT: ProductFormValues = {
  id: null,
  name: "",
  slug: "",
  sku: "",
  barcode: "",
  shortDescription: "",
  description: "",
  categoryId: "",
  brandId: "",
  productType: "",
  price: "",
  compareAtPrice: "",
  costPrice: "",
  salePrice: "",
  saleStartsAt: "",
  saleEndsAt: "",
  lowStockThreshold: "5",
  weightGrams: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  status: "DRAFT",
  isFeatured: false,
  isNewArrival: false,
  isBestSeller: false,
  seoTitle: "",
  seoDescription: "",
  specifications: [],
  images: [],
  hasVariants: false,
  stock: "0",
  currentStock: null,
  variants: [],
};

export function ProductForm({
  initial,
  categories,
  brands,
  attributes,
  canViewCost,
}: {
  initial: ProductFormValues;
  categories: CategoryOption[];
  brands: { id: string; name: string }[];
  attributes: AttributeOption[];
  canViewCost: boolean;
}) {
  const [values, setValues] = useState<ProductFormValues>({
    ...initial,
    saleStartsAt: toLocalInput(initial.saleStartsAt),
    saleEndsAt: toLocalInput(initial.saleEndsAt),
  });
  const { state, pending, formProps } = useActionForm<ActionResult<{ id: string }>>(saveProductAction);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const isNew = !initial.id;

  const usedAttributeIds = useMemo(() => {
    const ids = new Set<string>();
    values.variants.forEach((v) => v.options.forEach((o) => ids.add(o.attributeId)));
    return [...ids];
  }, [values.variants]);
  const [variantAttributes, setVariantAttributes] = useState<string[]>(usedAttributeIds);
  const [generatorValues, setGeneratorValues] = useState<Record<string, string[]>>({});

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const text = (key: keyof ProductFormValues) => ({
    value: String(values[key] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, e.target.value as never),
  });
  const err = (key: string) => errors[key];

  const payload = JSON.stringify({
    ...values,
    saleStartsAt: fromLocalInput(values.saleStartsAt),
    saleEndsAt: fromLocalInput(values.saleEndsAt),
    images: values.images.map((i) => ({ ...i, alt: i.alt || null })),
    variants: values.hasVariants
      ? values.variants.map((v) => ({ ...v, options: v.options.filter((o) => variantAttributes.includes(o.attributeId)) }))
      : [],
  });

  const updateVariant = (index: number, patch: Partial<Variant>) =>
    set(
      "variants",
      values.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    );

  const setVariantOption = (index: number, attributeId: string, valueId: string) => {
    const variant = values.variants[index]!;
    const options = variant.options.filter((o) => o.attributeId !== attributeId);
    if (valueId) options.push({ attributeId, valueId });
    updateVariant(index, { options });
  };

  const generateVariants = () => {
    const lists = variantAttributes.map((attributeId) => (generatorValues[attributeId] ?? []).map((valueId) => ({ attributeId, valueId })));
    if (lists.some((l) => l.length === 0)) return;
    const combos = lists.reduce<{ attributeId: string; valueId: string }[][]>((acc, list) => acc.flatMap((combo) => list.map((option) => [...combo, option])), [[]]);
    const existing = new Set(values.variants.map((v) => v.options.map((o) => o.valueId).sort().join("|")));
    const base = values.sku || "SKU";
    const added: Variant[] = combos
      .filter((combo) => !existing.has(combo.map((o) => o.valueId).sort().join("|")))
      .map((combo) => {
        const suffix = combo
          .map((o) => attributes.find((a) => a.id === o.attributeId)?.values.find((v) => v.id === o.valueId)?.value ?? "")
          .map((v) => slugify(v).toUpperCase().slice(0, 8))
          .join("-");
        return {
          id: null,
          sku: `${base}-${suffix}`,
          barcode: "",
          price: "",
          compareAtPrice: "",
          salePrice: "",
          costPrice: "",
          weightGrams: "",
          isActive: true,
          initialStock: "0",
          currentStock: null,
          options: combo,
        };
      });
    set("variants", [...values.variants, ...added]);
  };

  return (
    <form {...formProps} className="space-y-6 pb-24" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="payload" value={payload} />
      <FormMessage state={state} />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Section title="Basic information">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldBox label="Product name" required error={err("name")} className="sm:col-span-2">
                <Input id="p-name" {...text("name")} maxLength={160} aria-invalid={Boolean(err("name"))} />
              </FieldBox>
              <FieldBox label="URL slug" error={err("slug")} hint={`Leave empty to generate: ${slugify(values.name) || "product-name"}`}>
                <Input id="p-slug" {...text("slug")} placeholder={slugify(values.name)} />
              </FieldBox>
              <FieldBox label="SKU" required error={err("sku")}>
                <Input id="p-sku" {...text("sku")} onBlur={() => set("sku", values.sku.toUpperCase())} />
              </FieldBox>
              <FieldBox label="Category" required error={err("categoryId")}>
                <Select id="p-category" {...text("categoryId")}>
                  <option value="">Choose a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {"— ".repeat(c.depth - 1)}
                      {c.name}
                    </option>
                  ))}
                </Select>
              </FieldBox>
              <FieldBox label="Brand" error={err("brandId")}>
                <Select id="p-brand" {...text("brandId")}>
                  <option value="">No brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </FieldBox>
              <FieldBox label="Product type" error={err("productType")} hint="e.g. Smartwatch, Necklace">
                <Input id="p-type" {...text("productType")} />
              </FieldBox>
              {!values.hasVariants ? (
                <FieldBox label="Barcode" error={err("barcode")}>
                  <Input id="p-barcode" {...text("barcode")} />
                </FieldBox>
              ) : null}
            </div>
          </Section>

          <Section title="Description">
            <div className="space-y-4">
              <FieldBox label="Short description" error={err("shortDescription")} hint="Shown near the price. Up to 300 characters.">
                <Textarea id="p-short" {...text("shortDescription")} rows={2} maxLength={300} />
              </FieldBox>
              <FieldBox label="Full description" required error={err("description")} hint="Formatting: blank line = new paragraph, “## ” heading, “- ” bullet, **bold**.">
                <Textarea id="p-desc" {...text("description")} rows={8} />
              </FieldBox>
            </div>
          </Section>

          <Section title="Images">
            <GalleryEditor images={values.images as UploadedImage[]} onChange={(images) => set("images", images)} folder="products" />
            <FieldError messages={err("images")} />
          </Section>

          <Section title="Pricing" description="Prices in BDT. The lowest of the selling price, an active scheduled sale and any automatic promotion is charged.">
            <div className="grid gap-4 sm:grid-cols-3">
              <FieldBox label="Selling price (৳)" required error={err("price")}>
                <Input id="p-price" inputMode="decimal" {...text("price")} />
              </FieldBox>
              <FieldBox label="Original price / MRP (৳)" error={err("compareAtPrice")} hint="Optional, shown struck through.">
                <Input id="p-compare" inputMode="decimal" {...text("compareAtPrice")} />
              </FieldBox>
              {canViewCost ? (
                <FieldBox label="Cost price (৳)" error={err("costPrice")} hint="Internal only.">
                  <Input id="p-cost" inputMode="decimal" {...text("costPrice")} />
                </FieldBox>
              ) : null}
            </div>
            <div className="mt-4 grid gap-4 rounded-lg bg-ivory/50 p-4 sm:grid-cols-3">
              <FieldBox label="Scheduled sale price (৳)" error={err("salePrice")}>
                <Input id="p-sale" inputMode="decimal" {...text("salePrice")} />
              </FieldBox>
              <FieldBox label="Sale starts" error={err("saleStartsAt")} hint="Empty = immediately">
                <Input id="p-sale-start" type="datetime-local" {...text("saleStartsAt")} />
              </FieldBox>
              <FieldBox label="Sale ends" error={err("saleEndsAt")} hint="Empty = no end">
                <Input id="p-sale-end" type="datetime-local" {...text("saleEndsAt")} />
              </FieldBox>
            </div>
          </Section>

          <Section title="Inventory & variants">
            <Checkbox
              checked={values.hasVariants}
              onChange={(e) => set("hasVariants", e.target.checked)}
              label="This product has options such as colour, size or material"
              description="Each variant gets its own SKU, stock level and (optionally) price."
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <FieldBox label="Low-stock threshold" required error={err("lowStockThreshold")}>
                <Input id="p-threshold" inputMode="numeric" {...text("lowStockThreshold")} />
              </FieldBox>
              {!values.hasVariants ? (
                isNew || initial.currentStock === null ? (
                  <FieldBox label="Opening stock" error={err("stock")} hint="Later changes are made in Inventory.">
                    <Input id="p-stock" inputMode="numeric" {...text("stock")} />
                  </FieldBox>
                ) : (
                  <div>
                    <Label>Current stock</Label>
                    <p className="flex h-10 items-center gap-3 text-sm">
                      <strong className="text-lg">{initial.currentStock}</strong>
                      <Link href={`/admin/inventory?q=${encodeURIComponent(initial.sku)}`} className="link text-xs">
                        Adjust in inventory
                      </Link>
                    </p>
                  </div>
                )
              ) : null}
            </div>

            {values.hasVariants ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-lg border border-line p-4">
                  <p className="text-sm font-medium">Variant attributes</p>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {attributes.map((attribute) => (
                      <label key={attribute.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-ink"
                          checked={variantAttributes.includes(attribute.id)}
                          onChange={(e) =>
                            setVariantAttributes((current) => (e.target.checked ? [...current, attribute.id] : current.filter((id) => id !== attribute.id)))
                          }
                        />
                        {attribute.name}
                      </label>
                    ))}
                    {attributes.length === 0 ? (
                      <p className="text-sm text-muted">
                        No attributes yet. <Link href="/admin/attributes" className="link">Create attributes</Link> first.
                      </p>
                    ) : null}
                  </div>
                  {variantAttributes.length ? (
                    <div className="mt-4 space-y-3 border-t border-line pt-4">
                      <p className="text-xs text-muted">Quick generator: tick values and create every combination.</p>
                      {variantAttributes.map((attributeId) => {
                        const attribute = attributes.find((a) => a.id === attributeId);
                        if (!attribute) return null;
                        return (
                          <div key={attributeId} className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="w-28 font-medium">{attribute.name}</span>
                            {attribute.values.map((value) => (
                              <label key={value.id} className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-ink"
                                  checked={(generatorValues[attributeId] ?? []).includes(value.id)}
                                  onChange={(e) =>
                                    setGeneratorValues((g) => ({
                                      ...g,
                                      [attributeId]: e.target.checked ? [...(g[attributeId] ?? []), value.id] : (g[attributeId] ?? []).filter((id) => id !== value.id),
                                    }))
                                  }
                                />
                                {value.value}
                              </label>
                            ))}
                          </div>
                        );
                      })}
                      <Button variant="outline" size="sm" onClick={generateVariants}>
                        <Wand2 className="h-4 w-4" /> Generate variants
                      </Button>
                    </div>
                  ) : null}
                </div>

                <FieldError messages={err("variants")} />
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-ivory/60 text-xs uppercase tracking-wider text-muted">
                      <tr>
                        {variantAttributes.map((id) => (
                          <th key={id} className="px-3 py-2">
                            {attributes.find((a) => a.id === id)?.name}
                          </th>
                        ))}
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Price ৳</th>
                        <th className="px-3 py-2">Sale ৳</th>
                        {canViewCost ? <th className="px-3 py-2">Cost ৳</th> : null}
                        <th className="px-3 py-2">Stock</th>
                        <th className="px-3 py-2">Active</th>
                        <th className="px-3 py-2">
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {values.variants.map((variant, index) => (
                        <tr key={variant.id ?? `new-${index}`} className={cn("border-t border-line align-top", !variant.isActive && "bg-ivory/40 text-muted")}>
                          {variantAttributes.map((attributeId) => {
                            const attribute = attributes.find((a) => a.id === attributeId);
                            return (
                              <td key={attributeId} className="px-3 py-2">
                                <select
                                  aria-label={`${attribute?.name} for variant ${index + 1}`}
                                  className="h-9 w-full rounded-md border border-line px-2"
                                  value={variant.options.find((o) => o.attributeId === attributeId)?.valueId ?? ""}
                                  onChange={(e) => setVariantOption(index, attributeId, e.target.value)}
                                >
                                  <option value="">—</option>
                                  {attribute?.values.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.value}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2">
                            <input aria-label={`SKU for variant ${index + 1}`} className="h-9 w-40 rounded-md border border-line px-2" value={variant.sku} onChange={(e) => updateVariant(index, { sku: e.target.value.toUpperCase() })} />
                            <FieldError messages={err(`variants.${index}.sku`) ?? err(`variants.${index}.options`)} />
                          </td>
                          <td className="px-3 py-2">
                            <input aria-label={`Price for variant ${index + 1}`} placeholder="Inherit" inputMode="decimal" className="h-9 w-24 rounded-md border border-line px-2" value={variant.price} onChange={(e) => updateVariant(index, { price: e.target.value })} />
                            <FieldError messages={err(`variants.${index}.price`)} />
                          </td>
                          <td className="px-3 py-2">
                            <input aria-label={`Sale price for variant ${index + 1}`} placeholder="—" inputMode="decimal" className="h-9 w-24 rounded-md border border-line px-2" value={variant.salePrice} onChange={(e) => updateVariant(index, { salePrice: e.target.value })} />
                            <FieldError messages={err(`variants.${index}.salePrice`)} />
                          </td>
                          {canViewCost ? (
                            <td className="px-3 py-2">
                              <input aria-label={`Cost for variant ${index + 1}`} placeholder="—" inputMode="decimal" className="h-9 w-24 rounded-md border border-line px-2" value={variant.costPrice} onChange={(e) => updateVariant(index, { costPrice: e.target.value })} />
                            </td>
                          ) : null}
                          <td className="px-3 py-2">
                            {variant.id ? (
                              <span className="inline-flex h-9 items-center font-medium">{variant.currentStock ?? 0}</span>
                            ) : (
                              <input aria-label={`Opening stock for variant ${index + 1}`} inputMode="numeric" className="h-9 w-20 rounded-md border border-line px-2" value={variant.initialStock} onChange={(e) => updateVariant(index, { initialStock: e.target.value })} />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input type="checkbox" aria-label={`Variant ${index + 1} active`} className="mt-2.5 h-4 w-4 accent-ink" checked={variant.isActive} onChange={(e) => updateVariant(index, { isActive: e.target.checked })} />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => set("variants", values.variants.filter((_, i) => i !== index))}
                              className="mt-1 grid h-8 w-8 place-items-center rounded-md text-danger hover:bg-danger/10"
                              aria-label={`Remove variant ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {values.variants.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-3 py-6 text-center text-muted">
                            No variants yet — choose attributes and generate them, or add one manually.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    set("variants", [
                      ...values.variants,
                      { id: null, sku: "", barcode: "", price: "", compareAtPrice: "", salePrice: "", costPrice: "", weightGrams: "", isActive: true, initialStock: "0", currentStock: null, options: [] },
                    ])
                  }
                >
                  <Plus className="h-4 w-4" /> Add variant
                </Button>
                <p className="text-xs text-muted">
                  Empty price = inherit the product price and sale. Removing a variant that has orders deactivates it instead of deleting it. Stock for existing variants is changed in
                  Inventory.
                </p>
              </div>
            ) : null}
          </Section>

          <Section title="Specifications">
            <div className="space-y-2">
              {values.specifications.map((spec, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    aria-label={`Specification ${index + 1} label`}
                    placeholder="Label (e.g. Battery)"
                    className="h-9 w-1/3 rounded-md border border-line px-3 text-sm"
                    value={spec.label}
                    onChange={(e) => set("specifications", values.specifications.map((s, i) => (i === index ? { ...s, label: e.target.value } : s)))}
                  />
                  <input
                    aria-label={`Specification ${index + 1} value`}
                    placeholder="Value (e.g. 40 hours)"
                    className="h-9 flex-1 rounded-md border border-line px-3 text-sm"
                    value={spec.value}
                    onChange={(e) => set("specifications", values.specifications.map((s, i) => (i === index ? { ...s, value: e.target.value } : s)))}
                  />
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-md text-danger hover:bg-danger/10"
                    onClick={() => set("specifications", values.specifications.filter((_, i) => i !== index))}
                    aria-label={`Remove specification ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => set("specifications", [...values.specifications, { label: "", value: "" }])}>
                <Plus className="h-4 w-4" /> Add specification
              </Button>
              <FieldError messages={err("specifications")} />
            </div>
          </Section>

          <Section title="Shipping">
            <div className="grid gap-4 sm:grid-cols-4">
              <FieldBox label="Weight (g)" error={err("weightGrams")}>
                <Input id="p-weight" inputMode="numeric" {...text("weightGrams")} />
              </FieldBox>
              <FieldBox label="Length (cm)" error={err("lengthCm")}>
                <Input id="p-length" inputMode="decimal" {...text("lengthCm")} />
              </FieldBox>
              <FieldBox label="Width (cm)" error={err("widthCm")}>
                <Input id="p-width" inputMode="decimal" {...text("widthCm")} />
              </FieldBox>
              <FieldBox label="Height (cm)" error={err("heightCm")}>
                <Input id="p-height" inputMode="decimal" {...text("heightCm")} />
              </FieldBox>
            </div>
          </Section>

          <Section title="Search engine listing">
            <div className="space-y-4">
              <FieldBox label="SEO title" error={err("seoTitle")} hint={`${values.seoTitle.length}/70`}>
                <Input id="p-seo-title" {...text("seoTitle")} maxLength={70} placeholder={values.name} />
              </FieldBox>
              <FieldBox label="Meta description" error={err("seoDescription")} hint={`${values.seoDescription.length}/170`}>
                <Textarea id="p-seo-desc" {...text("seoDescription")} rows={2} maxLength={170} placeholder={values.shortDescription} />
              </FieldBox>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Status">
            <Select aria-label="Product status" {...text("status")}>
              <option value="DRAFT">Draft — hidden from the store</option>
              <option value="ACTIVE">Active — visible in the store</option>
              <option value="ARCHIVED">Archived — hidden, kept for history</option>
            </Select>
            <div className="mt-4 space-y-3">
              <Checkbox checked={values.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} label="Featured" />
              <Checkbox checked={values.isNewArrival} onChange={(e) => set("isNewArrival", e.target.checked)} label="New arrival" />
              <Checkbox checked={values.isBestSeller} onChange={(e) => set("isBestSeller", e.target.checked)} label="Best seller" />
            </div>
          </Section>
          {!isNew ? (
            <Alert tone="info">
              Price changes never affect existing orders — each order keeps its own price snapshot.
            </Alert>
          ) : null}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:left-64">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <p className="text-sm text-muted">{state && !state.ok ? <span className="text-danger">{state.message}</span> : isNew ? "New product" : "Editing product"}</p>
          <div className="flex gap-2">
            <Link href="/admin/products" className="inline-flex h-10 items-center rounded-md px-4 text-sm hover:bg-ivory">
              Cancel
            </Link>
            <SubmitButton pending={pending} pendingText="Saving…">
              {isNew ? "Create product" : "Save changes"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-sans text-base font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FieldBox({
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string[];
  hint?: string;
  className?: string;
  children: React.ReactElement<{ id?: string }>;
}) {
  return (
    <div className={className}>
      <Label htmlFor={children.props.id} required={required}>
        {label}
      </Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      <FieldError messages={error} />
    </div>
  );
}
