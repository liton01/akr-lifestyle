import { useSyncExternalStore } from "react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia(reducedMotionQuery);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

/** True when the visitor has asked the OS for less motion; autoplay must stay off then. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(reducedMotionQuery).matches, () => false);
}

/** True while the browser tab is in the background, so timers can stop. */
export function usePageHidden() {
  return useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "hidden", () => false);
}
