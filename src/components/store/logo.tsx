import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ storeName, logoUrl, className, inverted }: { storeName: string; logoUrl?: string; className?: string; inverted?: boolean }) {
  const isLifestyle = /lifestyle$/i.test(storeName);
  return (
    <Link href="/" className={cn("group inline-flex shrink-0 items-center gap-3 lg:gap-3.5", className)} aria-label={`${storeName} — home`}>
      {logoUrl ? (
        <Image src={logoUrl} alt={storeName} width={160} height={48} className="h-10 w-auto lg:h-12" priority />
      ) : (
        <>
          <LogoEmblem gradientId={inverted ? "akr-gold-inverted" : "akr-gold"} />
          <span className={cn("h-9 w-px lg:h-10", inverted ? "bg-gold/35" : "bg-gold/45")} aria-hidden="true" />
          <span className="flex flex-col leading-none">
            <span className={cn("font-display text-[24px] font-semibold tracking-[0.24em] lg:text-[28px]", inverted ? "text-ivory" : "text-ink")}>
              {storeName.replace(/\s*lifestyle$/i, "") || storeName}
            </span>
            {isLifestyle ? <span className="mt-1.5 text-[9px] font-medium tracking-[0.52em] text-gold-dark lg:text-[10px]">LIFESTYLE</span> : null}
          </span>
        </>
      )}
    </Link>
  );
}

/**
 * Diamond monogram: a faceted, gold-outlined lozenge with a serif "A" — a nod to the jewellery
 * line. Drawn as SVG so the hairlines stay crisp at any size. `gradientId` keeps the ids unique
 * when the logo appears twice on a page (header and footer).
 */
function LogoEmblem({ gradientId }: { gradientId: string }) {
  const stroke = `url(#${gradientId})`;
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0 lg:h-12 lg:w-12" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E8D6AE" />
          <stop offset="0.5" stopColor="#C6A66B" />
          <stop offset="1" stopColor="#8F7440" />
        </linearGradient>
      </defs>
      {/* The lozenge turns a quarter on hover; a square rotated 90° lands back in the same shape. */}
      <g className="origin-center transition-transform duration-700 ease-out [transform-box:fill-box] group-hover:rotate-90 motion-reduce:transition-none">
        <rect x="9.5" y="9.5" width="29" height="29" rx="1.5" transform="rotate(45 24 24)" fill="#171717" stroke={stroke} strokeWidth="1.4" />
        <rect x="13" y="13" width="22" height="22" rx="1" transform="rotate(45 24 24)" fill="none" stroke={stroke} strokeWidth="0.6" opacity="0.55" />
      </g>
      <text x="24" y="24" dy="0.36em" textAnchor="middle" fill={stroke} fontSize="19" fontWeight="600" className="font-display">
        A
      </text>
    </svg>
  );
}
