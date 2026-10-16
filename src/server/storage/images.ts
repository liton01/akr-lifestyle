import sharp, { type Metadata } from "sharp";
import { ValidationError } from "@/lib/errors";
import { randomToken } from "@/server/crypto";
import { getStorage } from "@/server/storage";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "gif", "heif"]);
export const UPLOAD_FOLDERS = ["products", "categories", "brands", "banners", "branding"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/**
 * Validate an uploaded image by decoding it (the declared MIME type is not trusted),
 * then re-encode it to WebP: this strips EXIF/GPS metadata, neutralises polyglot files,
 * normalises orientation and caps the dimensions. SVG is rejected.
 */
export async function processImage(input: Buffer, maxDimension = 2000) {
  if (input.byteLength === 0) throw new ValidationError("The file is empty.");
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new ValidationError("Images must be 5 MB or smaller.");
  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new ValidationError("The file is not a valid image.");
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    throw new ValidationError("Upload a JPEG, PNG, WebP or AVIF image.");
  }
  if ((metadata.width ?? 0) < 200 || (metadata.height ?? 0) < 200) {
    throw new ValidationError("Images must be at least 200 × 200 pixels.");
  }
  const { data, info } = await sharp(input, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height, contentType: "image/webp" as const };
}

export function storageKey(folder: UploadFolder, extension = "webp", now = new Date()) {
  const month = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${folder}/${month}/${randomToken(12).toLowerCase().replace(/[^a-z0-9]/g, "x")}.${extension}`;
}

export async function storeImage(input: Buffer, folder: UploadFolder) {
  const processed = await processImage(input, folder === "banners" || folder === "branding" ? 2400 : 2000);
  const stored = await getStorage().put(storageKey(folder), processed.buffer, processed.contentType);
  return { ...stored, width: processed.width, height: processed.height };
}
