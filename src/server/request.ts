import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP. Assumes the app runs behind a reverse proxy that sets
 * X-Forwarded-For (Nginx, Vercel, Cloudflare). Used only for rate limiting and audit logs.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return h.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Same-origin check for Route Handlers that mutate state (Server Actions already
 * verify Origin automatically).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
