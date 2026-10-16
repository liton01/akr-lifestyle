import { can } from "@/lib/permissions";
import { isAppError } from "@/lib/errors";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { enforceRateLimit, LIMITS } from "@/server/rate-limit";
import { isSameOrigin } from "@/server/request";
import { MAX_UPLOAD_BYTES, storeImage, UPLOAD_FOLDERS, type UploadFolder } from "@/server/storage/images";

const FOLDER_PERMISSION = {
  products: "product:write",
  categories: "catalog:write",
  brands: "catalog:write",
  banners: "promotion:write",
  branding: "settings:write",
} as const;

/** Authenticated image upload. Files are decoded and re-encoded server-side before storage. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const folderParam = new URL(request.url).searchParams.get("folder") ?? "";
  if (!(UPLOAD_FOLDERS as readonly string[]).includes(folderParam)) return Response.json({ error: "Invalid upload folder." }, { status: 400 });
  const folder = folderParam as UploadFolder;
  if (!can(user.role, FOLDER_PERMISSION[folder])) return Response.json({ error: "You do not have permission to upload here." }, { status: 403 });

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) return Response.json({ error: "Images must be 5 MB or smaller." }, { status: 413 });

  try {
    await enforceRateLimit(prisma, `upload:${user.id}`, LIMITS.upload[0], LIMITS.upload[1]);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "No file received." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "Images must be 5 MB or smaller." }, { status: 413 });
    const stored = await storeImage(Buffer.from(await file.arrayBuffer()), folder);
    return Response.json({ url: stored.url, key: stored.key, width: stored.width, height: stored.height });
  } catch (error) {
    if (isAppError(error)) return Response.json({ error: error.message }, { status: error.status });
    console.error("[upload] failed", error);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
