import type { ReactNode } from "react";

/**
 * Shared pieces of the header's action buttons (track order, account, cart), used by both the
 * server header and the client account menu. On phones only the icon shows; from `lg` the icon
 * sits in a bordered circle with a two-line label beside it. Put `group` on the parent link.
 */
export function HeaderActionIcon({ children }: { children: ReactNode }) {
  return (
    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink transition-colors group-hover:bg-ivory lg:h-11 lg:w-11 lg:border lg:border-line lg:bg-white lg:group-hover:border-gold lg:group-hover:bg-ivory">
      {children}
    </span>
  );
}

export function HeaderActionText({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <span className="hidden flex-col whitespace-nowrap text-left leading-tight lg:flex">
      <span className="max-w-32 truncate text-[11px] text-muted">{top}</span>
      <span className="text-sm font-semibold text-ink transition-colors group-hover:text-gold-deep">{bottom}</span>
    </span>
  );
}
