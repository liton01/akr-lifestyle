"use client";

import { useState } from "react";
import { SingleImageField } from "@/components/admin/image-upload";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { Checkbox, Field, FieldError, Input, Label, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionResult } from "@/lib/action-result";
import { BANNER_PLACEMENT_LABELS, COUPON_SCOPE_LABELS, DISCOUNT_SCOPE_LABELS } from "@/lib/constants";
import { saveBannerAction, saveCouponAction, saveDeliveryZoneAction, saveDiscountAction } from "@/server/actions/admin/store";

type Option = { id: string; name: string };

/** datetime-local input whose submitted value is an ISO (UTC) timestamp. */
export function DateTimeField({ name, label, defaultValue, hint, errors }: { name: string; label: string; defaultValue?: string | null; hint?: string; errors?: string[] }) {
  const toLocal = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };
  const [local, setLocal] = useState(toLocal(defaultValue));
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <div>
      <Label htmlFor={`dt-${name}`}>{label}</Label>
      <Input id={`dt-${name}`} type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} />
      <input type="hidden" name={name} value={iso} />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      <FieldError messages={errors} />
    </div>
  );
}

function MultiSelect({ name, label, options, defaultValue, errors, hint }: { name: string; label: string; options: Option[]; defaultValue: string[]; errors?: string[]; hint?: string }) {
  return (
    <div>
      <Label htmlFor={`ms-${name}`}>{label}</Label>
      <select id={`ms-${name}`} name={name} multiple defaultValue={defaultValue} size={Math.min(8, Math.max(4, options.length))} className="w-full rounded-md border border-line p-2 text-sm">
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted">{hint ?? "Hold Ctrl (Windows) or Cmd (Mac) to select several."}</p>
      <FieldError messages={errors} />
    </div>
  );
}

export type DiscountValues = {
  id: string | null;
  name: string;
  description: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: string;
  scope: "STORE_WIDE" | "PRODUCT" | "CATEGORY" | "BRAND";
  maxDiscountAmount: string;
  badgeLabel: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  productIds: string[];
  categoryIds: string[];
  brandIds: string[];
};

export function DiscountForm({ initial, products, categories, brands }: { initial: DiscountValues; products: Option[]; categories: Option[]; brands: Option[] }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(saveDiscountAction);
  const [scope, setScope] = useState(initial.scope);
  const [type, setType] = useState(initial.type);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-5" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Promotion name" name="name" required errors={errors?.name}>
          {(p) => <Input {...p} defaultValue={initial.name} />}
        </Field>
        <Field label="Badge label" name="badgeLabel" hint="Shown on product cards, e.g. “Eid -15%”." errors={errors?.badgeLabel}>
          {(p) => <Input {...p} maxLength={30} defaultValue={initial.badgeLabel} />}
        </Field>
        <Field label="Discount type" name="type" errors={errors?.type}>
          {(p) => (
            <Select {...p} value={type} onChange={(e) => setType(e.target.value as DiscountValues["type"])}>
              <option value="PERCENTAGE">Percentage off each item</option>
              <option value="FIXED_AMOUNT">Fixed amount off each item (৳)</option>
            </Select>
          )}
        </Field>
        <Field label={type === "PERCENTAGE" ? "Percentage (%)" : "Amount (৳)"} name="value" required errors={errors?.value}>
          {(p) => <Input {...p} inputMode="decimal" defaultValue={initial.value} />}
        </Field>
        {type === "PERCENTAGE" ? (
          <Field label="Maximum discount per item (৳)" name="maxDiscountAmount" hint="Optional cap." errors={errors?.maxDiscountAmount}>
            {(p) => <Input {...p} inputMode="decimal" defaultValue={initial.maxDiscountAmount} />}
          </Field>
        ) : null}
        <Field label="Applies to" name="scope" errors={errors?.scope}>
          {(p) => (
            <Select {...p} value={scope} onChange={(e) => setScope(e.target.value as DiscountValues["scope"])}>
              {Object.entries(DISCOUNT_SCOPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {scope === "PRODUCT" ? <MultiSelect name="productIds" label="Products" options={products} defaultValue={initial.productIds} errors={errors?.productIds} /> : null}
      {scope === "CATEGORY" ? (
        <MultiSelect name="categoryIds" label="Categories" options={categories} defaultValue={initial.categoryIds} errors={errors?.categoryIds} hint="Subcategories are included automatically." />
      ) : null}
      {scope === "BRAND" ? <MultiSelect name="brandIds" label="Brands" options={brands} defaultValue={initial.brandIds} errors={errors?.brandIds} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <DateTimeField name="startsAt" label="Starts" defaultValue={initial.startsAt} hint="Empty = starts immediately." errors={errors?.startsAt} />
        <DateTimeField name="endsAt" label="Ends" defaultValue={initial.endsAt} hint="Empty = no end date." errors={errors?.endsAt} />
      </div>
      <Field label="Internal description" name="description" errors={errors?.description}>
        {(p) => <Textarea {...p} rows={2} defaultValue={initial.description} />}
      </Field>
      <Checkbox name="isActive" defaultChecked={initial.isActive} label="Active" description="Inactive promotions are never applied, even inside their schedule." />
      <SubmitButton pending={pending}>{initial.id ? "Save promotion" : "Create promotion"}</SubmitButton>
    </form>
  );
}

export type CouponValues = {
  id: string | null;
  code: string;
  description: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: string;
  scope: "ORDER" | "PRODUCT" | "CATEGORY";
  minOrderAmount: string;
  maxDiscountAmount: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  usageLimit: string;
  perCustomerLimit: string;
  newCustomersOnly: boolean;
  appliesToSaleItems: boolean;
  productIds: string[];
  categoryIds: string[];
  usedCount: number;
};

export function CouponForm({ initial, products, categories }: { initial: CouponValues; products: Option[]; categories: Option[] }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(saveCouponAction);
  const [scope, setScope] = useState(initial.scope);
  const [type, setType] = useState(initial.type);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-5" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Code" name="code" required hint="Customers type this at checkout. Letters, numbers, - and _." errors={errors?.code}>
          {(p) => <Input {...p} defaultValue={initial.code} className="uppercase" />}
        </Field>
        <Field label="Discount type" name="type" errors={errors?.type}>
          {(p) => (
            <Select {...p} value={type} onChange={(e) => setType(e.target.value as CouponValues["type"])}>
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_AMOUNT">Fixed amount (৳)</option>
            </Select>
          )}
        </Field>
        <Field label={type === "PERCENTAGE" ? "Percentage (%)" : "Amount (৳)"} name="value" required errors={errors?.value}>
          {(p) => <Input {...p} inputMode="decimal" defaultValue={initial.value} />}
        </Field>
        <Field label="Maximum discount (৳)" name="maxDiscountAmount" hint="Optional cap for the whole order." errors={errors?.maxDiscountAmount}>
          {(p) => <Input {...p} inputMode="decimal" defaultValue={initial.maxDiscountAmount} />}
        </Field>
        <Field label="Minimum order amount (৳)" name="minOrderAmount" hint="Merchandise total after item discounts." errors={errors?.minOrderAmount}>
          {(p) => <Input {...p} inputMode="decimal" defaultValue={initial.minOrderAmount} />}
        </Field>
        <Field label="Applies to" name="scope" errors={errors?.scope}>
          {(p) => (
            <Select {...p} value={scope} onChange={(e) => setScope(e.target.value as CouponValues["scope"])}>
              {Object.entries(COUPON_SCOPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {scope === "PRODUCT" ? <MultiSelect name="productIds" label="Products" options={products} defaultValue={initial.productIds} errors={errors?.productIds} /> : null}
      {scope === "CATEGORY" ? <MultiSelect name="categoryIds" label="Categories" options={categories} defaultValue={initial.categoryIds} errors={errors?.categoryIds} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Total usage limit" name="usageLimit" hint={`Empty = unlimited. Used ${initial.usedCount} time(s).`} errors={errors?.usageLimit}>
          {(p) => <Input {...p} inputMode="numeric" defaultValue={initial.usageLimit} />}
        </Field>
        <Field label="Uses per customer" name="perCustomerLimit" hint="Counted by account and phone number." errors={errors?.perCustomerLimit}>
          {(p) => <Input {...p} inputMode="numeric" defaultValue={initial.perCustomerLimit} />}
        </Field>
        <DateTimeField name="startsAt" label="Valid from" defaultValue={initial.startsAt} errors={errors?.startsAt} />
        <DateTimeField name="endsAt" label="Valid until" defaultValue={initial.endsAt} errors={errors?.endsAt} />
      </div>
      <Field label="Description" name="description" errors={errors?.description}>
        {(p) => <Textarea {...p} rows={2} defaultValue={initial.description} />}
      </Field>
      <div className="space-y-3">
        <Checkbox name="isActive" defaultChecked={initial.isActive} label="Active" />
        <Checkbox name="newCustomersOnly" defaultChecked={initial.newCustomersOnly} label="First order only" description="Only customers without a previous (non-cancelled) order can use it." />
        <Checkbox name="appliesToSaleItems" defaultChecked={initial.appliesToSaleItems} label="Apply to items already on sale" description="When unticked, discounted items are excluded from the coupon." />
      </div>
      <SubmitButton pending={pending}>{initial.id ? "Save coupon" : "Create coupon"}</SubmitButton>
    </form>
  );
}

export type BannerValues = {
  id: string | null;
  title: string;
  subtitle: string;
  imageUrl: string;
  mobileImageUrl: string;
  linkUrl: string;
  ctaLabel: string;
  placement: "HOME_HERO" | "HOME_PROMO" | "HOME_STRIP" | "OFFERS_PAGE";
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export function BannerForm({ initial }: { initial: BannerValues }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(saveBannerAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-5" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Title" name="title" required errors={errors?.title}>
          {(p) => <Input {...p} defaultValue={initial.title} />}
        </Field>
        <Field label="Placement" name="placement" errors={errors?.placement}>
          {(p) => (
            <Select {...p} defaultValue={initial.placement}>
              {Object.entries(BANNER_PLACEMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Subtitle" name="subtitle" errors={errors?.subtitle} className="sm:col-span-2">
          {(p) => <Input {...p} defaultValue={initial.subtitle} />}
        </Field>
        <Field label="Link" name="linkUrl" hint="e.g. /category/watches" errors={errors?.linkUrl}>
          {(p) => <Input {...p} defaultValue={initial.linkUrl} />}
        </Field>
        <Field label="Button label" name="ctaLabel" errors={errors?.ctaLabel}>
          {(p) => <Input {...p} defaultValue={initial.ctaLabel} />}
        </Field>
        <Field label="Display order" name="sortOrder" errors={errors?.sortOrder}>
          {(p) => <Input {...p} type="number" defaultValue={initial.sortOrder} />}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <SingleImageField name="imageUrl" label="Image" defaultValue={initial.imageUrl} folder="banners" hint="Wide images (e.g. 2400×800) for strips, 1200×900 for tiles." />
          <FieldError messages={errors?.imageUrl} />
        </div>
        <SingleImageField name="mobileImageUrl" label="Mobile image (optional)" defaultValue={initial.mobileImageUrl} folder="banners" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <DateTimeField name="startsAt" label="Show from" defaultValue={initial.startsAt} errors={errors?.startsAt} />
        <DateTimeField name="endsAt" label="Show until" defaultValue={initial.endsAt} errors={errors?.endsAt} />
      </div>
      <Checkbox name="isActive" defaultChecked={initial.isActive} label="Active" />
      <SubmitButton pending={pending}>{initial.id ? "Save banner" : "Create banner"}</SubmitButton>
    </form>
  );
}

export type ZoneValues = {
  id: string | null;
  name: string;
  districts: string[];
  fee: string;
  freeDeliveryThreshold: string;
  estimatedDays: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

export function DeliveryZoneForm({ initial, districts, onDone }: { initial: ZoneValues; districts: readonly string[]; onDone?: () => void }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(async (prev, formData) => {
    const result = await saveDeliveryZoneAction(prev, formData);
    if (result.ok) onDone?.();
    return result;
  });
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-4" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Zone name" name="name" required errors={errors?.name}>
          {(p) => <Input {...p} defaultValue={initial.name} />}
        </Field>
        <Field label="Delivery fee (৳)" name="fee" required errors={errors?.fee}>
          {(p) => <Input {...p} inputMode="decimal" defaultValue={initial.fee} />}
        </Field>
        <Field label="Free delivery over (৳)" name="freeDeliveryThreshold" hint="Empty = never free." errors={errors?.freeDeliveryThreshold}>
          {(p) => <Input {...p} inputMode="decimal" defaultValue={initial.freeDeliveryThreshold} />}
        </Field>
        <Field label="Estimated time" name="estimatedDays" errors={errors?.estimatedDays}>
          {(p) => <Input {...p} placeholder="e.g. 2–3 working days" defaultValue={initial.estimatedDays} />}
        </Field>
        <Field label="Display order" name="sortOrder" errors={errors?.sortOrder}>
          {(p) => <Input {...p} type="number" defaultValue={initial.sortOrder} />}
        </Field>
      </div>
      <MultiSelect
        name="districts"
        label="Districts in this zone"
        options={districts.map((d) => ({ id: d, name: d }))}
        defaultValue={initial.districts}
        errors={errors?.districts}
        hint="A district can belong to only one zone. The default zone covers all remaining districts."
      />
      <div className="flex flex-wrap gap-6">
        <Checkbox name="isDefault" defaultChecked={initial.isDefault} label="Default zone (all other districts)" />
        <Checkbox name="isActive" defaultChecked={initial.isActive} label="Active" />
      </div>
      <SubmitButton pending={pending} pendingText="Saving…">
        {initial.id ? "Save zone" : "Add zone"}
      </SubmitButton>
    </form>
  );
}
