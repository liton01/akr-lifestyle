import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/server/env";

/**
 * Pluggable file storage.
 * • local — writes to LOCAL_STORAGE_DIR and serves files through /media/*. Development
 *   only (or a single server with a persistent disk). Not suitable for serverless hosts.
 * • s3    — any S3-compatible bucket (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO),
 *   served from S3_PUBLIC_URL / CDN.
 */
export interface StorageProvider {
  readonly name: string;
  put(key: string, body: Buffer, contentType: string): Promise<{ key: string; url: string }>;
  remove(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{0,250}$/;

export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.includes("//")) throw new Error("Invalid storage key");
}

class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  constructor(private readonly root: string) {}
  resolve(key: string) {
    assertSafeKey(key);
    const full = path.resolve(/*turbopackIgnore: true*/ this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage path");
    return full;
  }
  async put(key: string, body: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    return { key, url: `/media/${key}` };
  }
  async remove(key: string) {
    await unlink(this.resolve(key)).catch(() => undefined);
  }
}

class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  private client: S3Client;
  constructor(
    private readonly config: {
      bucket: string;
      publicUrl: string;
      region: string;
      endpoint?: string;
      accessKeyId: string;
      secretAccessKey: string;
      forcePathStyle: boolean;
    },
  ) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }
  async put(key: string, body: Buffer, contentType: string) {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { key, url: `${this.config.publicUrl.replace(/\/$/, "")}/${key}` };
  }
  async remove(key: string) {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}

let provider: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (provider) return provider;
  const e = env();
  if (e.STORAGE_PROVIDER === "s3") {
    if (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY || !e.S3_PUBLIC_URL) {
      throw new Error("STORAGE_PROVIDER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_URL.");
    }
    provider = new S3StorageProvider({
      bucket: e.S3_BUCKET,
      publicUrl: e.S3_PUBLIC_URL,
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
    });
  } else {
    if (e.NODE_ENV === "production") {
      console.warn("[storage] Using local file storage in production. Configure STORAGE_PROVIDER=s3 for durable uploads.");
    }
    // Runtime data directory — excluded from build output tracing.
    provider = new LocalStorageProvider(path.resolve(/*turbopackIgnore: true*/ process.cwd(), e.LOCAL_STORAGE_DIR));
  }
  return provider;
}

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
};

/** Read a file from local storage for the /media route. Returns null when missing or unsafe. */
export async function readLocalMedia(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  const e = env();
  if (e.STORAGE_PROVIDER !== "local") return null;
  try {
    assertSafeKey(key);
  } catch {
    return null;
  }
  const root = path.resolve(/*turbopackIgnore: true*/ process.cwd(), e.LOCAL_STORAGE_DIR);
  const full = path.resolve(/*turbopackIgnore: true*/ root, key);
  if (!full.startsWith(root + path.sep)) return null;
  const contentType = CONTENT_TYPES[path.extname(full).toLowerCase()];
  if (!contentType) return null;
  try {
    return { body: await readFile(full), contentType };
  } catch {
    return null;
  }
}
