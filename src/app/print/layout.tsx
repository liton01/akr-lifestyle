import type { ReactNode } from "react";
import { PrintButton } from "@/components/admin/print-button";
import { requireStaffPage } from "@/server/auth/session";

export const metadata = { title: "Print", robots: { index: false, follow: false } };

export default async function PrintLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("order:read", "/admin/orders");
  return (
    <div className="min-h-screen bg-ivory/40 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end px-4">
        <PrintButton />
      </div>
      <div className="mx-auto max-w-3xl bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none">{children}</div>
    </div>
  );
}
