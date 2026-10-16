"use client";

import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { Spinner } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

export type UploadedImage = { url: string; storageKey: string | null; alt: string; width: number | null; height: number | null };
type Folder = "products" | "categories" | "brands" | "banners" | "branding";

async function uploadFile(file: File, folder: Folder): Promise<UploadedImage> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`/api/admin/uploads?folder=${folder}`, { method: "POST", body });
  const json = (await response.json().catch(() => ({}))) as { url?: string; key?: string; width?: number; height?: number; error?: string };
  if (!response.ok || !json.url) throw new Error(json.error ?? "Upload failed.");
  return { url: json.url, storageKey: json.key ?? null, alt: "", width: json.width ?? null, height: json.height ?? null };
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/** Single image field: uploads and writes the URL into a hidden input named `name`. */
export function SingleImageField({ name, label, defaultValue, folder, hint }: { name: string; label: string; defaultValue?: string | null; folder: Folder; hint?: string }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-start gap-4">
        <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-line bg-ivory/50">
          {url ? <Image src={url} alt="" fill sizes="96px" className="object-cover" /> : <ImagePlus className="h-6 w-6 text-muted" aria-hidden="true" />}
        </div>
        <div className="space-y-2 text-sm">
          <label htmlFor={inputId} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line px-3 hover:bg-ivory">
            {busy ? <Spinner /> : null} {url ? "Replace image" : "Upload image"}
          </label>
          <input
            id={inputId}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setBusy(true);
              setError(null);
              try {
                setUrl((await uploadFile(file, folder)).url);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Upload failed.");
              } finally {
                setBusy(false);
              }
            }}
          />
          {url ? (
            <button type="button" onClick={() => setUrl("")} className="block text-xs text-danger hover:underline">
              Remove image
            </button>
          ) : null}
          {hint ? <p className="text-xs text-muted">{hint}</p> : null}
          {error ? (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Multi-image gallery editor with ordering and alt text (controlled). */
export function GalleryEditor({ images, onChange, folder, max = 12 }: { images: UploadedImage[]; onChange: (images: UploadedImage[]) => void; folder: Folder; max?: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const move = (index: number, delta: number) => {
    const next = [...images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((image, index) => (
          <li key={`${image.url}-${index}`} className={cn("rounded-lg border bg-white p-2", index === 0 ? "border-gold" : "border-line")}>
            <div className="relative aspect-square overflow-hidden rounded-md bg-ivory">
              <Image src={image.url} alt={image.alt || ""} fill sizes="200px" className="object-cover" />
              {index === 0 ? <span className="absolute left-1.5 top-1.5 rounded bg-gold px-1.5 py-0.5 text-[10px] font-semibold text-ink">Main</span> : null}
            </div>
            <label className="sr-only" htmlFor={`alt-${index}`}>
              Alt text for image {index + 1}
            </label>
            <input
              id={`alt-${index}`}
              value={image.alt}
              onChange={(e) => onChange(images.map((img, i) => (i === index ? { ...img, alt: e.target.value } : img)))}
              placeholder="Alt text"
              maxLength={160}
              className="mt-2 h-8 w-full rounded border border-line px-2 text-xs"
            />
            <div className="mt-2 flex justify-between">
              <div className="flex gap-1">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="grid h-7 w-7 place-items-center rounded border border-line disabled:opacity-30" aria-label="Move image earlier">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === images.length - 1}
                  className="grid h-7 w-7 place-items-center rounded border border-line disabled:opacity-30"
                  aria-label="Move image later"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" onClick={() => onChange(images.filter((_, i) => i !== index))} className="grid h-7 w-7 place-items-center rounded border border-line text-danger" aria-label="Remove image">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
        {images.length < max ? (
          <li>
            <label
              htmlFor={inputId}
              className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-ivory/40 text-sm text-muted hover:border-gold hover:text-ink"
            >
              {busy ? <Spinner /> : <ImagePlus className="h-6 w-6" aria-hidden="true" />}
              {busy ? "Uploading…" : "Add images"}
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              disabled={busy}
              onChange={async (event) => {
                const files = Array.from(event.target.files ?? []).slice(0, max - images.length);
                event.target.value = "";
                if (!files.length) return;
                setBusy(true);
                setError(null);
                const uploaded: UploadedImage[] = [];
                for (const file of files) {
                  try {
                    uploaded.push(await uploadFile(file, folder));
                  } catch (e) {
                    setError(`${file.name}: ${e instanceof Error ? e.message : "Upload failed."}`);
                  }
                }
                onChange([...images, ...uploaded]);
                setBusy(false);
              }}
            />
          </li>
        ) : null}
      </ul>
      <p className="mt-2 text-xs text-muted">JPEG, PNG, WebP or AVIF up to 5 MB, at least 200×200 px. Images are optimised automatically. The first image is the main image.</p>
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
