import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Period } from "@/server/services/period";

const PRESETS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "month", label: "This month" },
] as const;

/** Date-range filter row: presets first, then a custom range. Scopes everything below it. */
export function PeriodFilter({ basePath, period }: { basePath: string; period: Period }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-3 shadow-sm">
      <nav aria-label="Date range presets" className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <Link
            key={p.value}
            href={`${basePath}?range=${p.value}`}
            aria-current={period.preset === p.value ? "true" : undefined}
            className={cn("rounded-md px-3 py-1.5 text-sm", period.preset === p.value ? "bg-ink text-ivory" : "text-charcoal hover:bg-ivory")}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2 border-l border-line pl-3">
        <label className="text-xs text-muted">
          From
          <input type="date" name="from" defaultValue={period.fromInput} className="ml-1 h-8 rounded-md border border-line px-2 text-sm text-ink" />
        </label>
        <label className="text-xs text-muted">
          To
          <input type="date" name="to" defaultValue={period.toInput} className="ml-1 h-8 rounded-md border border-line px-2 text-sm text-ink" />
        </label>
        <button type="submit" className={cn("h-8 rounded-md border px-3 text-sm", period.preset === "custom" ? "border-ink bg-ink text-ivory" : "border-line hover:bg-ivory")}>
          Apply
        </button>
      </form>
    </div>
  );
}
