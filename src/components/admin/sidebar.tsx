"use client";

import {
  BarChart3,
  Bell,
  FolderTree,
  Gauge,
  Image as ImageIcon,
  Mail,
  Menu,
  Package,
  Percent,
  RotateCcw,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  Ticket,
  Truck,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AdminNavGroup } from "./nav";

const ICONS: Record<string, typeof Gauge> = {
  dashboard: Gauge,
  reports: BarChart3,
  orders: ShoppingCart,
  returns: RotateCcw,
  customers: Users,
  messages: Mail,
  products: Package,
  inventory: Warehouse,
  categories: FolderTree,
  brands: Tag,
  attributes: SlidersHorizontal,
  discounts: Percent,
  coupons: Ticket,
  banners: ImageIcon,
  delivery: Truck,
  settings: Settings,
  staff: ShieldCheck,
  notifications: Bell,
  audit: ScrollText,
};

export function AdminSidebar({ groups, storeName }: { groups: AdminNavGroup[]; storeName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label="Admin" className="space-y-6 px-3 py-4" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ivory/40">{group.label}</p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? Gauge;
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active ? "bg-gold text-ink" : "text-ivory/75 hover:bg-white/5 hover:text-ivory",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="flex h-14 items-center justify-between bg-ink px-4 text-ivory lg:hidden">
        <Link href="/admin" className="font-display text-lg font-semibold text-gold">
          {storeName} Admin
        </Link>
        <button type="button" onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-md hover:bg-white/10" aria-label="Open admin menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" className="absolute inset-0 bg-ink/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-ink">
            <div className="flex h-14 items-center justify-between px-4">
              <span className="font-display text-lg text-gold">{storeName}</span>
              <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-md text-ivory hover:bg-white/10" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}
      <aside className="fixed inset-y-0 left-0 hidden w-64 overflow-y-auto bg-ink lg:block">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-6">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-gold text-[11px] font-bold text-gold">AKR</span>
          <span className="font-display text-lg font-semibold text-ivory">Admin</span>
        </div>
        {nav}
      </aside>
    </>
  );
}
