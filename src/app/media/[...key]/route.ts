import { readLocalMedia } from "@/server/storage";

/**
 * Serves files from local storage (STORAGE_PROVIDER=local). With S3-compatible storage,
 * files are served directly from S3_PUBLIC_URL and this route returns 404.
 */
export async function GET(_request: Request, context: RouteContext<"/media/[...key]">) {
  const { key } = await context.params;
  const file = await readLocalMedia(key.join("/"));
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "content-type": file.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
