import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "block w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70 shadow-sm transition-colors focus:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold/30 disabled:cursor-not-allowed disabled:bg-ivory/60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

export function Label({ className, children, required, ...props }: ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-ink", className)} {...props}>
      {children}
      {required ? (
        <span className="ml-0.5 text-danger" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(control, "py-2 leading-6", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, label, description, ...props }: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-line accent-ink" {...props} />
      <span>
        <span className="font-medium text-ink">{label}</span>
        {description ? <span className="block text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function FieldError({ id, messages }: { id?: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-danger" role="alert">
      {messages[0]}
    </p>
  );
}

export function Hint({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="mt-1.5 text-xs text-muted">
      {children}
    </p>
  );
}

/** Label + control + hint + error with correct aria wiring. */
export function Field({
  label,
  name,
  required,
  hint,
  errors,
  className,
  children,
}: {
  label: ReactNode;
  name: string;
  required?: boolean;
  hint?: ReactNode;
  errors?: string[];
  className?: string;
  children: (props: { id: string; name: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = `field-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const describedBy = [hint ? `${id}-hint` : null, errors?.length ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children({ id, name, "aria-invalid": Boolean(errors?.length), "aria-describedby": describedBy })}
      {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
      <FieldError id={`${id}-error`} messages={errors} />
    </div>
  );
}
