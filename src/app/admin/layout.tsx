import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ADMIN_NAV } from "@/components/admin/nav";
import { AdminSidebar } from "@/components/admin/sidebar";
import { can, isStaffRole, ROLE_LABELS } from "@/lib/permissions";
import { signOutAction } from "@/server/actions/auth";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/cache";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isStaffRole(user.role)) redirect("/");
  const settings = await getSettings();
  const groups = ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(user.role, i.permission)) })).filter((g) => g.items.length);

  return (
    <div className="min-h-screen bg-[#f7f5f0]">
      <AdminSidebar groups={groups} storeName={settings.general.storeName} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-line bg-white/90 px-8 backdrop-blur lg:flex">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-charcoal hover:text-ink" target="_blank">
            View store <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-right leading-tight">
              <span className="block font-medium">{user.name}</span>
              <span className="block text-xs text-muted">{ROLE_LABELS[user.role]}</span>
            </span>
            <form action={signOutAction}>
              <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-ivory">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
