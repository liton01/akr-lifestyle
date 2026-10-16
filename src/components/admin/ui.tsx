import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back ? (
          <Link href={back.href} className="text-sm text-muted hover:text-ink">
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="mt-1 font-display text-3xl font-semibold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, description, actions, children, className }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-white p-5 shadow-sm sm:p-6", className)}>
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="font-sans text-base font-semibold">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-line bg-white shadow-sm", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className, align }: { children?: ReactNode; className?: string; align?: "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line bg-ivory/50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, align }: { children?: ReactNode; className?: string; align?: "right" | "center" }) {
  return <td className={cn("border-b border-line/70 px-4 py-3 align-middle", align === "right" && "text-right tabular-nums", align === "center" && "text-center", className)}>{children}</td>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}

/** GET filter form (server-rendered; works without JavaScript). */
export function FilterBar({ action, children, resetHref }: { action: string; children: ReactNode; resetHref?: string }) {
  return (
    <form method="get" action={action} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4 shadow-sm">
      {children}
      <button type="submit" className="h-9 rounded-md bg-ink px-4 text-sm font-medium text-ivory hover:bg-ink-soft">
        Apply
      </button>
      {resetHref ? (
        <Link href={resetHref} className="grid h-9 place-items-center rounded-md border border-line px-3 text-sm hover:bg-ivory">
          Reset
        </Link>
      ) : null}
    </form>
  );
}

export function FilterField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export const filterInput = "h-9 rounded-md border border-line bg-white px-3 text-sm focus:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold/30";

export function StatCard({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: "warning" | "danger" | "success" }) {
  const content = (
    <div className={cn("h-full rounded-xl border bg-white p-5 shadow-sm", href && "transition-colors hover:border-gold", tone === "danger" ? "border-danger/30" : tone === "warning" ? "border-warning/30" : "border-line")}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", tone === "danger" && "text-danger", tone === "warning" && "text-warning", tone === "success" && "text-success")}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}

export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex justify-between gap-4 py-2">
          <dt className="text-muted">{item.label}</dt>
          <dd className="text-right">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
