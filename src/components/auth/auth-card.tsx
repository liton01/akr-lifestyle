import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-12 sm:py-20">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="eyebrow">AKR Lifestyle</p>
          <h1 className="mt-2 text-4xl font-semibold">{title}</h1>
          {subtitle ? <p className="mt-3 text-sm text-muted">{subtitle}</p> : null}
        </div>
        <div className="card p-6 sm:p-8">{children}</div>
        {footer ? <div className="mt-6 text-center text-sm text-charcoal">{footer}</div> : null}
      </div>
    </div>
  );
}
