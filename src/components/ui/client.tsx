"use client";

import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { Alert, Spinner } from "./feedback";

/** Submit button that shows a pending state while its form's action runs. */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  className,
  pending: pendingOverride,
  ...props
}: Omit<ComponentProps<"button">, "type"> & { pendingText?: string; variant?: ButtonVariant; size?: ButtonSize; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingOverride ?? status.pending;
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending || props.disabled} aria-disabled={pending} {...props}>
      {pending ? (
        <>
          <Spinner />
          {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/** Displays the message from a Server Action result. */
export function FormMessage({ state, className }: { state: ActionResult<unknown> | null; className?: string }) {
  if (!state?.message) return null;
  return (
    <Alert tone={state.ok ? "success" : "danger"} className={className}>
      {state.message}
    </Alert>
  );
}

/**
 * A submit button that asks for confirmation in an accessible native <dialog>
 * before submitting its surrounding form.
 */
export function ConfirmSubmit({
  children,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  size = "sm",
  className,
  name,
  value,
}: {
  children: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  name?: string;
  value?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const { pending } = useFormStatus();
  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} disabled={pending} onClick={() => dialogRef.current?.showModal()}>
        {pending ? <Spinner /> : null}
        {children}
      </Button>
      <button ref={submitRef} type="submit" name={name} value={value} hidden tabIndex={-1} aria-hidden="true" />
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line p-0 shadow-2xl backdrop:bg-ink/50"
        aria-labelledby={titleId}
      >
        <div className="p-6">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {title}
          </h2>
          {description ? <div className="mt-2 text-sm text-muted">{description}</div> : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button
              variant={variant === "danger" ? "danger" : "primary"}
              onClick={() => {
                dialogRef.current?.close();
                submitRef.current?.click();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Toast-style message that disappears after a few seconds. */
export function FlashMessage({ message, tone = "success" }: { message: string | null; tone?: "success" | "danger" }) {
  const [visible, setVisible] = useState(Boolean(message));
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  if (!message || !visible) return null;
  return (
    <div className={cn("fixed bottom-4 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2")}>
      <div className="rounded-lg bg-white shadow-lg">
        <Alert tone={tone}>{message}</Alert>
      </div>
    </div>
  );
}
