import type { ReactNode } from "react";

/**
 * Shared pieces of the header's action buttons (track order, account, cart), used by both the
 * server header and the client account menu. On phones only the icon shows; from `lg` the icon
 * sits in a bordered circle with a two-line label beside it. Put `group` on the parent link.
 */
export function HeaderActionIcon({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors lg:h-11 lg:w-11 lg:border ${dark ? "border-ivory/20 bg-ink text-ivory group-hover:bg-ink lg:group-hover:border-gold" : "border-line bg-white text-ink group-hover:bg-ivory lg:group-hover:border-gold"}`}>
      {children}
    </span>
  );
}

export function HeaderActionText({ top, bottom, dark = false }: { top: ReactNode; bottom: ReactNode; dark?: boolean }) {
  return (
    <span className="hidden flex-col whitespace-nowrap text-left leading-tight lg:flex">
      <span className={`max-w-32 truncate text-[11px] ${dark ? "text-ivory/55" : "text-muted"}`}>{top}</span>
      <span className={`text-sm font-semibold transition-colors ${dark ? "text-ivory group-hover:text-gold" : "text-ink group-hover:text-gold-deep"}`}>{bottom}</span>
    </span>
  );
}
