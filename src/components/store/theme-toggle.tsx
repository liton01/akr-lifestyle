"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, parseTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { HeaderActionIcon } from "./header-parts";

function storeRoot() {
  return document.querySelector<HTMLElement>("[data-store-root]");
}

function subscribe(callback: () => void) {
  const root = storeRoot();
  if (!root) return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Switches the storefront theme right away and remembers it for the next visit. */
function setStoreTheme(next: Theme) {
  const root = storeRoot();
  if (!root) return;
  root.classList.add("theme-switching");
  root.dataset.theme = next;
  document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
  // Let the new colours paint before transitions come back, so nothing fades halfway.
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
}

/** The theme the store is showing now. The store root's data-theme is the single source of truth. */
function useStoreTheme(initial: Theme): Theme {
  return useSyncExternalStore(subscribe, () => parseTheme(storeRoot()?.dataset.theme), () => initial);
}

/** Round header button: a moon in light mode, a sun in dark mode. */
export function ThemeToggle({ initial, className }: { initial: Theme; className?: string }) {
  const dark = useStoreTheme(initial) === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button type="button" onClick={() => setStoreTheme(dark ? "light" : "dark")} className={cn("group", className)} aria-label={label} title={label}>
      <HeaderActionIcon>{dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}</HeaderActionIcon>
    </button>
  );
}

/** "Dark mode" on/off switch for the mobile menu. */
export function ThemeSwitch({ initial, className }: { initial: Theme; className?: string }) {
  const dark = useStoreTheme(initial) === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={() => setStoreTheme(dark ? "light" : "dark")}
      className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-charcoal hover:bg-ivory hover:text-ink", className)}
    >
      {dark ? <Sun className="h-4 w-4 text-gold-dark" aria-hidden="true" /> : <Moon className="h-4 w-4 text-gold-dark" aria-hidden="true" />}
      <span className="flex-1 text-left">Dark mode</span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", dark ? "bg-gold" : "bg-line")} aria-hidden="true">
        <span className={cn("absolute left-0 top-0.5 h-4 w-4 rounded-full bg-pearl shadow transition-transform", dark ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
    </button>
  );
}
