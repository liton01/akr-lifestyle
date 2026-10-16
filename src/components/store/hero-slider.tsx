"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HeroSlide = {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  ctaLabel: string | null;
  secondaryCtaLabel: string | null;
  secondaryLinkUrl: string | null;
  textTone: "LIGHT" | "DARK";
};

const INTERVAL_MS = 6500;
const SWIPE_PX = 50;

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

/**
 * Full-width homepage hero carousel driven by HOME_HERO banners (Admin → Banners).
 * Crossfades between slides and auto-advances, pausing on hover, keyboard focus, a hidden
 * tab, the pause button, or when the visitor prefers reduced motion. Supports arrows, dots,
 * swipe and the left/right arrow keys. Off-screen slides are inert so links stay in order.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const pointerStart = useRef<number | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(reducedMotionQuery).matches, () => false);
  const hidden = useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "hidden", () => false);
  const playing = count > 1 && !userPaused && !hovered && !focused && !hidden && !reducedMotion;
  const current = slides[index] ?? slides[0]!;
  const lightControls = current.textTone === "LIGHT";

  const goTo = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  // Restart the timer whenever the slide changes, so manual navigation gets a full interval.
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [playing, count, index]);

  const onPointerUp = (event: PointerEvent) => {
    if (pointerStart.current === null) return;
    const dx = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(dx) > SWIPE_PX) goTo(index + (dx < 0 ? 1 : -1));
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured collections"
      className="relative h-[78svh] min-h-[480px] max-h-[760px] overflow-hidden bg-ink"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") goTo(index + 1);
        if (event.key === "ArrowLeft") goTo(index - 1);
      }}
      onPointerDown={(event) => {
        pointerStart.current = event.clientX;
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
    >
      <div className="h-full" aria-live={playing ? "off" : "polite"}>
        {slides.map((slide, i) => {
          const active = i === index;
          const light = slide.textTone === "LIGHT";
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}: ${slide.title}`}
              aria-hidden={!active}
              inert={!active}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none",
                active ? "z-10 opacity-100" : "z-0 opacity-0",
              )}
            >
              <Image
                src={slide.imageUrl}
                alt=""
                fill
                priority={i === 0}
                sizes="100vw"
                className={cn("object-cover", slide.mobileImageUrl ? "hidden md:block" : "object-[72%_50%] md:object-center")}
              />
              {slide.mobileImageUrl ? (
                <Image src={slide.mobileImageUrl} alt="" fill priority={i === 0} sizes="100vw" className="object-cover md:hidden" />
              ) : null}
              {/* Scrims keep the text readable on any photo. */}
              <div
                className={cn(
                  "absolute inset-0 hidden md:block",
                  light ? "bg-gradient-to-r from-ink/85 via-ink/40 to-transparent" : "bg-gradient-to-r from-ivory/90 via-ivory/45 to-transparent",
                )}
              />
              <div
                className={cn(
                  "absolute inset-0 md:hidden",
                  light ? "bg-gradient-to-t from-ink/90 via-ink/45 to-ink/5" : "bg-gradient-to-t from-ivory/95 via-ivory/55 to-ivory/5",
                )}
              />

              <div className="container-page relative flex h-full items-end pb-28 md:items-center md:pb-0">
                <div
                  className={cn(
                    "max-w-xl transition duration-700 delay-150 ease-out motion-reduce:translate-y-0 motion-reduce:transition-none",
                    active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                  )}
                >
                  {slide.eyebrow ? <p className={cn("eyebrow", light ? "text-gold" : "text-gold-deep")}>{slide.eyebrow}</p> : null}
                  <h2 className={cn("mt-3 text-5xl font-semibold leading-[1.04] sm:text-6xl lg:text-7xl", light ? "text-ivory" : "text-ink")}>{slide.title}</h2>
                  {slide.subtitle ? (
                    <p className={cn("mt-5 max-w-lg text-base leading-7 sm:text-lg", light ? "text-ivory/80" : "text-charcoal")}>{slide.subtitle}</p>
                  ) : null}
                  {slide.linkUrl || slide.secondaryLinkUrl ? (
                    <div className="mt-8 flex flex-wrap gap-3">
                      {slide.linkUrl ? (
                        <ButtonLink href={slide.linkUrl} variant={light ? "gold" : "primary"} size="lg">
                          {slide.ctaLabel || "Shop now"}
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </ButtonLink>
                      ) : null}
                      {slide.secondaryLinkUrl ? (
                        <ButtonLink href={slide.secondaryLinkUrl} variant={light ? "outlineLight" : "outline"} size="lg">
                          {slide.secondaryCtaLabel || "Learn more"}
                        </ButtonLink>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <div className="absolute inset-x-0 bottom-6 z-20">
          <div className="container-page flex items-center justify-between gap-4">
            <div className="flex items-center gap-2" role="group" aria-label="Choose a slide">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}: ${slide.title}`}
                  aria-current={i === index ? "true" : undefined}
                  className="group grid h-8 place-items-center"
                >
                  <span
                    className={cn(
                      "relative block h-1 overflow-hidden rounded-full transition-all duration-300",
                      i === index ? "w-12" : "w-5",
                      lightControls ? "bg-ivory/35 group-hover:bg-ivory/60" : "bg-ink/20 group-hover:bg-ink/40",
                    )}
                  >
                    {i === index ? (
                      <span
                        key={`${index}-${playing}`}
                        className={cn("absolute inset-0 origin-left rounded-full", lightControls ? "bg-gold" : "bg-ink", playing ? "hero-progress" : "")}
                        style={playing ? { animationDuration: `${INTERVAL_MS}ms` } : undefined}
                      />
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <ControlButton light={lightControls} onClick={() => setUserPaused((p) => !p)} label={userPaused ? "Play slideshow" : "Pause slideshow"}>
                {userPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </ControlButton>
              <ControlButton light={lightControls} onClick={() => goTo(index - 1)} label="Previous slide">
                <ChevronLeft className="h-5 w-5" />
              </ControlButton>
              <ControlButton light={lightControls} onClick={() => goTo(index + 1)} label="Next slide">
                <ChevronRight className="h-5 w-5" />
              </ControlButton>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ControlButton({ light, onClick, label, children }: { light: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full border backdrop-blur-sm transition-colors",
        light ? "border-ivory/40 bg-ink/20 text-ivory hover:bg-ivory hover:text-ink" : "border-ink/30 bg-white/40 text-ink hover:bg-ink hover:text-ivory",
      )}
    >
      {children}
    </button>
  );
}
