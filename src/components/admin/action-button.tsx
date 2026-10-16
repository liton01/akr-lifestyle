"use client";

import type { ReactNode } from "react";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/**
 * A one-button form bound to a Server Action, with optional confirmation dialog and
 * inline result message (e.g. "This brand still has products").
 */
export function ActionButton({
  action,
  fields,
  children,
  confirm,
  variant = "outline",
  size = "sm",
  className,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  children: ReactNode;
  confirm?: { title: string; description?: ReactNode; confirmLabel?: string };
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { state, pending, formProps } = useActionForm<ActionResult>(action);
  return (
    <form {...formProps} className={cn("inline-flex flex-col items-start", className)}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {confirm ? (
        <ConfirmSubmit title={confirm.title} description={confirm.description} confirmLabel={confirm.confirmLabel} variant={variant} size={size}>
          {children}
        </ConfirmSubmit>
      ) : (
        <SubmitButton pending={pending} variant={variant} size={size}>
          {children}
        </SubmitButton>
      )}
      {state?.message ? (
        <span role="status" className={cn("mt-1 max-w-xs text-xs", state.ok ? "text-success" : "text-danger")}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
