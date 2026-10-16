import type { Role } from "@prisma/client";

/**
 * Role-based permission matrix. Every privileged server action and admin page
 * checks one of these permissions on the server — hiding UI is never relied on.
 */
export const PERMISSIONS = {
  "admin:access": ["ADMIN", "STORE_MANAGER", "INVENTORY_MANAGER"],
  "dashboard:view": ["ADMIN", "STORE_MANAGER", "INVENTORY_MANAGER"],
  "dashboard:view-sales": ["ADMIN", "STORE_MANAGER"],

  "product:read": ["ADMIN", "STORE_MANAGER", "INVENTORY_MANAGER"],
  "product:write": ["ADMIN", "STORE_MANAGER"],
  "product:delete": ["ADMIN"],
  "product:view-cost": ["ADMIN"],

  "catalog:write": ["ADMIN", "STORE_MANAGER"], // categories, brands, attributes

  "inventory:read": ["ADMIN", "STORE_MANAGER", "INVENTORY_MANAGER"],
  "inventory:adjust": ["ADMIN", "INVENTORY_MANAGER"],

  "order:read": ["ADMIN", "STORE_MANAGER", "INVENTORY_MANAGER"],
  "order:update": ["ADMIN", "STORE_MANAGER"],
  "order:refund": ["ADMIN", "STORE_MANAGER"],

  "promotion:write": ["ADMIN", "STORE_MANAGER"], // discounts, coupons, banners

  "customer:read": ["ADMIN", "STORE_MANAGER"],
  "customer:manage": ["ADMIN"],

  "staff:manage": ["ADMIN"],
  "settings:write": ["ADMIN"],
  "delivery:write": ["ADMIN", "STORE_MANAGER"],
  "reports:view": ["ADMIN", "STORE_MANAGER"],
  "reports:inventory": ["ADMIN", "STORE_MANAGER", "INVENTORY_MANAGER"],
  "audit:view": ["ADMIN"],
  "messages:read": ["ADMIN", "STORE_MANAGER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const STAFF_ROLES: readonly Role[] = ["ADMIN", "STORE_MANAGER", "INVENTORY_MANAGER"];

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: "Customer",
  ADMIN: "Administrator",
  STORE_MANAGER: "Store Manager",
  INVENTORY_MANAGER: "Inventory Manager",
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function isStaffRole(role: Role | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

/** The authenticated principal performing an operation. */
export type Actor = {
  id: string;
  role: Role;
  email: string;
  name: string;
};
