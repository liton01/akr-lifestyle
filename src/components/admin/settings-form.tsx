"use client";

import { ImagePlus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { Spinner } from "@/components/ui/feedback";
import { Checkbox, FieldError, Input, Label, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionResult } from "@/lib/action-result";
import type { SettingsGroup } from "@/lib/settings-schema";
import { saveSettingsAction } from "@/server/actions/admin/store";
import type { SettingsField } from "./settings-config";

type Values = Record<string, unknown>;

const TIME_ZONES = ["Asia/Dhaka", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "UTC"];

function ImageInput({ id, value, onChange }: { id: string; value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileId = useId();
  return (
    <div className="flex items-start gap-4">
      <div className="relative grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-line bg-ivory/50">
        {value ? <Image src={value} alt="" fill sizes="128px" className="object-contain" /> : <ImagePlus className="h-5 w-5 text-muted" aria-hidden="true" />}
      </div>
      <div className="space-y-2 text-sm">
        <label htmlFor={fileId} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line px-3 hover:bg-ivory">
          {busy ? <Spinner /> : null} {value ? "Replace" : "Upload"}
        </label>
        <input
          id={fileId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setBusy(true);
            setError(null);
            const body = new FormData();
            body.append("file", file);
            try {
              const response = await fetch("/api/admin/uploads?folder=branding", { method: "POST", body });
              const json = (await response.json()) as { url?: string; error?: string };
              if (!response.ok || !json.url) throw new Error(json.error ?? "Upload failed.");
              onChange(json.url);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Upload failed.");
            } finally {
              setBusy(false);
            }
          }}
        />
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="/media/… or https://…" className="h-8 w-72 text-xs" />
        {value ? (
          <button type="button" className="block text-xs text-danger hover:underline" onClick={() => onChange("")}>
            Remove
          </button>
        ) : null}
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    </div>
  );
}

export function SettingsForm({ group, fields, initial }: { group: SettingsGroup; fields: SettingsField[]; initial: Values }) {
  const [values, setValues] = useState<Values>(initial);
  const { state, pending, formProps } = useActionForm<ActionResult>(saveSettingsAction);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <form {...formProps} className="space-y-6" noValidate>
      <input type="hidden" name="group" value={group} />
      <input type="hidden" name="payload" value={JSON.stringify(values)} />
      <FormMessage state={state} />
      {fields.map((field) => {
        const id = `setting-${group}-${field.key}`;
        const fieldErrors = errors[field.key];
        if (field.type === "boolean") {
          return (
            <div key={field.key}>
              <Checkbox checked={Boolean(values[field.key])} onChange={(e) => set(field.key, e.target.checked)} label={field.label} description={field.hint} />
              <FieldError messages={fieldErrors} />
            </div>
          );
        }
        if (field.type === "list") {
          const items = (values[field.key] as Record<string, string>[] | undefined) ?? [];
          return (
            <fieldset key={field.key} className="space-y-3">
              <legend className="text-sm font-medium">{field.label}</legend>
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 rounded-lg border border-line p-3">
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    {field.itemFields.map((sub) => {
                      const subId = `${id}-${index}-${sub.key}`;
                      const update = (value: string) => set(field.key, items.map((it, i) => (i === index ? { ...it, [sub.key]: value } : it)));
                      return (
                        <div key={sub.key} className={sub.type === "textarea" ? "sm:col-span-2" : ""}>
                          <label htmlFor={subId} className="mb-1 block text-xs text-muted">
                            {sub.label}
                          </label>
                          {sub.type === "textarea" ? (
                            <Textarea id={subId} rows={2} value={item[sub.key] ?? ""} onChange={(e) => update(e.target.value)} />
                          ) : (
                            <Input id={subId} value={item[sub.key] ?? ""} onChange={(e) => update(e.target.value)} />
                          )}
                          <FieldError messages={errors[`${field.key}.${index}.${sub.key}`]} />
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center self-start rounded-md text-danger hover:bg-danger/10"
                    onClick={() => set(field.key, items.filter((_, i) => i !== index))}
                    aria-label={`Remove ${field.label} item ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {items.length < field.max ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => set(field.key, [...items, Object.fromEntries(field.itemFields.map((f) => [f.key, ""]))])}
                >
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              ) : null}
              <FieldError messages={fieldErrors} />
            </fieldset>
          );
        }
        return (
          <div key={field.key}>
            <Label htmlFor={id}>{field.label}</Label>
            {field.type === "textarea" ? (
              <Textarea id={id} rows={field.rows ?? 4} value={String(values[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} aria-invalid={Boolean(fieldErrors)} />
            ) : field.type === "image" ? (
              <ImageInput id={id} value={String(values[field.key] ?? "")} onChange={(url) => set(field.key, url)} />
            ) : field.type === "number" ? (
              <Input id={id} type="number" value={String(values[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value === "" ? "" : Number(e.target.value))} className="w-40" />
            ) : field.type === "timezone" ? (
              <Select id={id} value={String(values[field.key] ?? "Asia/Dhaka")} onChange={(e) => set(field.key, e.target.value)} className="w-64">
                {TIME_ZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            ) : (
              <Input id={id} type={field.type === "email" ? "email" : "text"} value={String(values[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} aria-invalid={Boolean(fieldErrors)} />
            )}
            {field.hint ? <p className="mt-1 text-xs text-muted">{field.hint}</p> : null}
            <FieldError messages={fieldErrors} />
          </div>
        );
      })}
      <div className="sticky bottom-0 -mx-5 border-t border-line bg-white/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <SubmitButton pending={pending} pendingText="Saving…">
          Save settings
        </SubmitButton>
      </div>
    </form>
  );
}
