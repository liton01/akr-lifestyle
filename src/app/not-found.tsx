import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-4 text-center text-ivory">
      <Link href="/" className="grid h-14 w-14 place-items-center rounded-full border border-gold font-display text-base font-bold text-gold" aria-label="AKR Lifestyle home">
        AKR
      </Link>
      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.3em] text-gold">Error 404</p>
      <h1 className="mt-3 font-display text-5xl font-semibold sm:text-6xl">Page not found</h1>
      <p className="mt-4 max-w-md text-ivory/70">The page you are looking for may have moved, or the link may be incorrect.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex h-11 items-center rounded-md bg-gold px-5 text-sm font-medium text-ink hover:bg-gold-dark hover:text-white">
          Back to home
        </Link>
        <Link href="/shop" className="inline-flex h-11 items-center rounded-md border border-ivory/40 px-5 text-sm font-medium hover:bg-ivory hover:text-ink">
          Browse products
        </Link>
      </div>
    </main>
  );
}
