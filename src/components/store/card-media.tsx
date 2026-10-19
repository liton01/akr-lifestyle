"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePageHidden, usePrefersReducedMotion } from "./motion-hooks";

const INTERVAL_MS = 3500;
const SWIPE_PX = 40;
const SIZES = "(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw";

/**
 * Product-card image area. With several gallery images it crossfades through them on its own
 * while the card is on screen, pausing on hover (where arrows appear), in a background tab, and
 * for visitors who prefer reduced motion. Dots and swipe work too. The whole image stays a link
 * to the product; the slide controls sit beside the link, not inside it, and are left out of the
 * tab order because the product page carries the full gallery.
 */
export function CardMedia({
  href,
  name,
  images,
  priority,
  autoplayDelayMs = 0,
  raiseDots,
  children,
}: {
  href: string;
  name: string;
  images: { url: string; alt: string }[];
  priority?: boolean;
  /** Extra wait before the first slide change, so neighbouring cards don't all change at once. */
  autoplayDelayMs?: number;
  /** Lift the dots above a bottom banner such as "Out of stock". */
  raiseDots?: boolean;
  /** Badges and other overlays; they let clicks through to the link. */
  children?: ReactNode;
}) {
  const count = images.length;
  const [index, setIndex] = useState(0);
  // Images are mounted lazily: the current one plus the next, so a card never loads its whole gallery up front.
  const [mountedUpTo, setMountedUpTo] = useState(1);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const advanced = useRef(false);
  const pointerStart = useRef<number | null>(null);
  const swiped = useRef(false);
  const reducedMotion = usePrefersReducedMotion();
  const hidden = usePageHidden();
  const playing = count > 1 && inView && !hovered && !hidden && !reducedMotion;

  const goTo = (next: number) => {
    const target = ((next % count) + count) % count;
    advanced.current = true;
    setIndex(target);
    setMountedUpTo((m) => Math.max(m, Math.min(target + 1, count - 1)));
  };

  useEffect(() => {
    const element = containerRef.current;
    if (count < 2 || !element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold: 0.6 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [count]);

  useEffect(() => {
    if (!playing) return;
    const delay = INTERVAL_MS + (advanced.current ? 0 : autoplayDelayMs);
    const timer = window.setTimeout(() => {
      advanced.current = true;
      const next = (index + 1) % count;
      setIndex(next);
      setMountedUpTo((m) => Math.max(m, Math.min(next + 1, count - 1)));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [playing, index, count, autoplayDelayMs]);

  return (
    <div
      ref={containerRef}
      data-slides={count}
      data-active-slide={index}
      className="group/media relative touch-pan-y overflow-hidden rounded-[var(--radius-card)] bg-ivory"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHovered(false);
      }}
      onPointerDown={(event) => {
        pointerStart.current = count > 1 ? event.clientX : null;
      }}
      onPointerUp={(event) => {
        if (pointerStart.current === null) return;
        const dx = event.clientX - pointerStart.current;
        pointerStart.current = null;
        if (Math.abs(dx) > SWIPE_PX) {
          swiped.current = true;
          goTo(index + (dx < 0 ? 1 : -1));
        }
      }}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
      onClickCapture={(event) => {
        // A swipe ends in a click on the link; swallow it so swiping never opens the product.
        if (swiped.current) {
          swiped.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <Link href={href} className="relative block aspect-square" aria-label={name} draggable={false}>
        {images.map((image, i) =>
          i <= mountedUpTo ? (
            <Image
              key={`${i}-${image.url}`}
              src={image.url}
              alt={i === 0 ? image.alt : ""}
              fill
              sizes={SIZES}
              priority={priority && i === 0}
              draggable={false}
              className={cn(
                "object-cover transition-[opacity,transform] duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none",
                i === index ? "opacity-100" : "opacity-0",
              )}
            />
          ) : null,
        )}
      </Link>

      {children}

      {count > 1 ? (
        <>
          <SlideArrow side="left" onClick={() => goTo(index - 1)} />
          <SlideArrow side="right" onClick={() => goTo(index + 1)} />
          <div className={cn("absolute inset-x-0 flex justify-center", raiseDots ? "bottom-12" : "bottom-3")} aria-hidden="true">
            <div className="flex items-center gap-1 rounded-full bg-white/75 px-2 py-1.5 shadow-sm backdrop-blur-sm">
              {images.map((image, i) => (
                <button
                  key={`${i}-${image.url}`}
                  type="button"
                  tabIndex={-1}
                  onClick={() => goTo(i)}
                  className="grid h-3 place-items-center"
                  aria-label={`Show image ${i + 1} of ${count}`}
                >
                  <span className={cn("block h-1.5 rounded-full transition-all duration-300", i === index ? "w-4 bg-ink" : "w-1.5 bg-ink/30 hover:bg-ink/60")} />
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SlideArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={onClick}
      className={cn(
        "absolute top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-200 hover:bg-white group-hover/media:opacity-100 md:grid",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
