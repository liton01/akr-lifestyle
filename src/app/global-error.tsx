"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#171717", color: "#F6F1E7" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <p style={{ color: "#C6A66B", letterSpacing: "0.3em", fontSize: 12, fontWeight: 600 }}>AKR LIFESTYLE</p>
          <h1 style={{ fontSize: 36, margin: "12px 0" }}>Something went wrong</h1>
          <p style={{ opacity: 0.75, maxWidth: 420 }}>An unexpected error occurred. Please try again.</p>
          {error.digest ? <p style={{ opacity: 0.5, fontSize: 12 }}>Reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 24, background: "#C6A66B", color: "#171717", border: 0, borderRadius: 6, padding: "12px 20px", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
