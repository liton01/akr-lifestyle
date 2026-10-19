import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "gold" | "solid" | "dark" | "light";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-ivory text-charcoal ring-line",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/25",
  danger: "bg-danger/10 text-danger ring-danger/20",
  info: "bg-info/10 text-info ring-info/20",
  gold: "bg-gold/15 text-gold-deep ring-gold/30",
  solid: "bg-gold text-onyx ring-gold",
  dark: "bg-onyx text-pearl ring-onyx",
  light: "bg-white/90 text-ink ring-line",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

const alertTones: Record<"success" | "warning" | "danger" | "info", { cls: string; Icon: typeof Info }> = {
  success: { cls: "border-success/30 bg-success/5 text-success", Icon: CheckCircle2 },
  warning: { cls: "border-warning/30 bg-warning/5 text-warning", Icon: TriangleAlert },
  danger: { cls: "border-danger/30 bg-danger/5 text-danger", Icon: AlertCircle },
  info: { cls: "border-info/30 bg-info/5 text-info", Icon: Info },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof alertTones;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { cls, Icon } = alertTones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-ink/80">{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-ivory/40 px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-4 text-gold-dark">{icon}</div> : null}
      <h3 className="font-display text-2xl font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
      role="status"
      aria-label="Loading"
    />
  );
}
