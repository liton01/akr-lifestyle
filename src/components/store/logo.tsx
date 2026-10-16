import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ storeName, logoUrl, className, inverted }: { storeName: string; logoUrl?: string; className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5", className)} aria-label={`${storeName} — home`}>
      {logoUrl ? (
        <Image src={logoUrl} alt={storeName} width={160} height={48} className="h-10 w-auto" priority />
      ) : (
        <>
          <span
            className={cn(
              "grid h-10 w-10 place-items-center rounded-full border font-display text-sm font-bold tracking-wider",
              inverted ? "border-gold/60 text-gold" : "border-gold bg-ink text-gold",
            )}
            aria-hidden="true"
          >
            AKR
          </span>
          <span className="flex flex-col leading-none">
            <span className={cn("font-display text-xl font-semibold tracking-wide", inverted ? "text-ivory" : "text-ink")}>
              {storeName.replace(/\s*lifestyle$/i, "") || storeName}
            </span>
            {/lifestyle$/i.test(storeName) ? <span className="mt-0.5 text-[10px] font-semibold tracking-[0.35em] text-gold-dark">LIFESTYLE</span> : null}
          </span>
        </>
      )}
    </Link>
  );
}
