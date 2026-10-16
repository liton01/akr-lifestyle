import { formatBDT } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Price({
  amount,
  compareAt,
  from,
  size = "md",
  className,
}: {
  amount: number;
  compareAt?: number | null;
  from?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const main = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      {from ? <span className="text-xs text-muted">From</span> : null}
      <span className={cn("font-semibold text-ink", main)}>{formatBDT(amount)}</span>
      {compareAt && compareAt > amount ? (
        <span className={cn("text-muted line-through", size === "lg" ? "text-base" : "text-xs")}>
          <span className="sr-only">Was </span>
          {formatBDT(compareAt)}
        </span>
      ) : null}
    </span>
  );
}

export function Money({ amount, className }: { amount: number; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{formatBDT(amount)}</span>;
}
