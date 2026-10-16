import type { Permission } from "@/lib/permissions";

export type AdminNavItem = { href: string; label: string; icon: string; permission: Permission };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: "dashboard", permission: "dashboard:view" },
      { href: "/admin/reports", label: "Reports", icon: "reports", permission: "reports:inventory" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "orders", permission: "order:read" },
      { href: "/admin/returns", label: "Returns", icon: "returns", permission: "order:read" },
      { href: "/admin/customers", label: "Customers", icon: "customers", permission: "customer:read" },
      { href: "/admin/messages", label: "Messages", icon: "messages", permission: "messages:read" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: "products", permission: "product:read" },
      { href: "/admin/inventory", label: "Inventory", icon: "inventory", permission: "inventory:read" },
      { href: "/admin/categories", label: "Categories", icon: "categories", permission: "product:read" },
      { href: "/admin/brands", label: "Brands", icon: "brands", permission: "product:read" },
      { href: "/admin/attributes", label: "Attributes", icon: "attributes", permission: "product:read" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/discounts", label: "Promotions", icon: "discounts", permission: "promotion:write" },
      { href: "/admin/coupons", label: "Coupons", icon: "coupons", permission: "promotion:write" },
      { href: "/admin/banners", label: "Banners", icon: "banners", permission: "promotion:write" },
    ],
  },
  {
    label: "Store",
    items: [
      { href: "/admin/delivery", label: "Delivery zones", icon: "delivery", permission: "delivery:write" },
      { href: "/admin/settings", label: "Settings", icon: "settings", permission: "settings:write" },
      { href: "/admin/staff", label: "Staff & roles", icon: "staff", permission: "staff:manage" },
      { href: "/admin/notifications", label: "Notification log", icon: "notifications", permission: "audit:view" },
      { href: "/admin/audit", label: "Audit log", icon: "audit", permission: "audit:view" },
    ],
  },
];
