import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import type { ActionResult, FieldErrors } from "@/lib/action-result";
import { isAppError, ValidationError } from "@/lib/errors";

export function zodFieldErrors(error: ZodError): FieldErrors {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/**
 * Wrap a server action body: domain errors become user-facing messages, unexpected
 * errors are logged and replaced by a generic message (no internals leak to clients).
 * Next.js control-flow errors (redirect, notFound) are re-thrown.
 */
export async function runAction<T = undefined>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return {
        ok: false,
        message: first ? `Please check the form: ${first.message}` : "Please correct the highlighted fields.",
        fieldErrors: zodFieldErrors(error),
      };
    }
    if (error instanceof ValidationError) {
      return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
    }
    if (isAppError(error)) return { ok: false, message: error.message };
    console.error("[action] Unexpected error", error);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/** Convert FormData into a plain object (repeated keys become arrays). */
export function formToObject(formData: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value !== "string") continue;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}
