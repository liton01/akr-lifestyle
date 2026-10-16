"use client";

import { SingleImageField } from "@/components/admin/image-upload";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionResult } from "@/lib/action-result";
import { saveAttributeAction, saveAttributeValueAction, saveBrandAction, saveCategoryAction } from "@/server/actions/admin/catalog";

export type CategoryFormValues = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  parentId: string;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
};

export function CategoryForm({ initial, parents }: { initial: CategoryFormValues; parents: { id: string; name: string; depth: number }[] }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(saveCategoryAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-5" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" name="name" required errors={errors?.name}>
          {(p) => <Input {...p} defaultValue={initial.name} required />}
        </Field>
        <Field label="Slug" name="slug" hint="Leave empty to generate from the name." errors={errors?.slug}>
          {(p) => <Input {...p} defaultValue={initial.slug} />}
        </Field>
        <Field label="Parent category" name="parentId" errors={errors?.parentId}>
          {(p) => (
            <Select {...p} defaultValue={initial.parentId}>
              <option value="">None (top level)</option>
              {parents.map((c) => (
                <option key={c.id} value={c.id}>
                  {"— ".repeat(c.depth - 1)}
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Display order" name="sortOrder" hint="Lower numbers appear first." errors={errors?.sortOrder}>
          {(p) => <Input {...p} type="number" defaultValue={initial.sortOrder} />}
        </Field>
      </div>
      <Field label="Description" name="description" errors={errors?.description}>
        {(p) => <Textarea {...p} rows={3} defaultValue={initial.description} />}
      </Field>
      <SingleImageField name="imageUrl" label="Category image" defaultValue={initial.imageUrl} folder="categories" hint="Square images work best." />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="SEO title" name="seoTitle" errors={errors?.seoTitle}>
          {(p) => <Input {...p} maxLength={70} defaultValue={initial.seoTitle} />}
        </Field>
        <Field label="Meta description" name="seoDescription" errors={errors?.seoDescription}>
          {(p) => <Input {...p} maxLength={170} defaultValue={initial.seoDescription} />}
        </Field>
      </div>
      <Checkbox name="isActive" defaultChecked={initial.isActive} label="Active" description="Inactive categories and their products are hidden from the store." />
      <SubmitButton pending={pending} pendingText="Saving…">
        {initial.id ? "Save category" : "Create category"}
      </SubmitButton>
    </form>
  );
}

export type BrandFormValues = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  website: string;
  sortOrder: number;
  isActive: boolean;
};

export function BrandForm({ initial }: { initial: BrandFormValues }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(saveBrandAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-5" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" name="name" required errors={errors?.name}>
          {(p) => <Input {...p} defaultValue={initial.name} required />}
        </Field>
        <Field label="Slug" name="slug" hint="Leave empty to generate from the name." errors={errors?.slug}>
          {(p) => <Input {...p} defaultValue={initial.slug} />}
        </Field>
        <Field label="Website" name="website" errors={errors?.website}>
          {(p) => <Input {...p} type="url" placeholder="https://" defaultValue={initial.website} />}
        </Field>
        <Field label="Display order" name="sortOrder" errors={errors?.sortOrder}>
          {(p) => <Input {...p} type="number" defaultValue={initial.sortOrder} />}
        </Field>
      </div>
      <Field label="Description" name="description" errors={errors?.description}>
        {(p) => <Textarea {...p} rows={3} defaultValue={initial.description} />}
      </Field>
      <SingleImageField name="logoUrl" label="Logo" defaultValue={initial.logoUrl} folder="brands" />
      <Checkbox name="isActive" defaultChecked={initial.isActive} label="Active" />
      <SubmitButton pending={pending} pendingText="Saving…">
        {initial.id ? "Save brand" : "Create brand"}
      </SubmitButton>
    </form>
  );
}

export function AttributeForm({ initial }: { initial?: { id: string; name: string; displayType: "TEXT" | "COLOR"; sortOrder: number } }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(saveAttributeAction);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-3" noValidate>
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Field label="Attribute name" name={initial ? `name-${initial.id}` : "name"} errors={errors?.name}>
        {(p) => <Input {...p} name="name" defaultValue={initial?.name} placeholder="e.g. Color" className="w-44" required />}
      </Field>
      <Field label="Display" name={initial ? `display-${initial.id}` : "displayType"}>
        {(p) => (
          <Select {...p} name="displayType" defaultValue={initial?.displayType ?? "TEXT"} className="w-32">
            <option value="TEXT">Text</option>
            <option value="COLOR">Colour swatch</option>
          </Select>
        )}
      </Field>
      <Field label="Order" name={initial ? `order-${initial.id}` : "sortOrder"}>
        {(p) => <Input {...p} name="sortOrder" type="number" defaultValue={initial?.sortOrder ?? 0} className="w-20" />}
      </Field>
      <SubmitButton pending={pending} variant={initial ? "outline" : "primary"} pendingText="Saving…">
        {initial ? "Save" : "Add attribute"}
      </SubmitButton>
      {state?.message ? <p className={state.ok ? "w-full text-xs text-success" : "w-full text-xs text-danger"}>{state.message}</p> : null}
    </form>
  );
}

export function AttributeValueForm({ attributeId, color }: { attributeId: string; color: boolean }) {
  const { state, pending, formProps } = useActionForm<ActionResult>(saveAttributeValueAction);
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-2" noValidate>
      <input type="hidden" name="attributeId" value={attributeId} />
      <input type="hidden" name="sortOrder" value="0" />
      <label className="sr-only" htmlFor={`value-${attributeId}`}>
        New value
      </label>
      <input id={`value-${attributeId}`} name="value" placeholder="New value" className="h-8 w-36 rounded-md border border-line px-2 text-sm" required />
      {color ? (
        <>
          <label className="sr-only" htmlFor={`color-${attributeId}`}>
            Colour
          </label>
          <input id={`color-${attributeId}`} name="colorHex" type="color" defaultValue="#171717" className="h-8 w-10 rounded border border-line" />
        </>
      ) : null}
      <SubmitButton pending={pending} size="sm" variant="outline">
        Add
      </SubmitButton>
      {state && !state.ok ? <p className="w-full text-xs text-danger">{state.message}</p> : null}
    </form>
  );
}
