import { describe, expect, it } from "vitest";
import { canCustomerCancel, canStaffTransition, STAFF_TRANSITIONS } from "@/lib/order-status";
import { can, isStaffRole } from "@/lib/permissions";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { assertPermission } from "@/server/services/authz";

describe("role-based access", () => {
  it("never grants admin permissions to customers", () => {
    for (const permission of ["admin:access", "product:write", "order:update", "settings:write", "inventory:adjust", "product:view-cost"] as const) {
      expect(can("CUSTOMER", permission)).toBe(false);
    }
    expect(isStaffRole("CUSTOMER")).toBe(false);
  });

  it("separates manager responsibilities", () => {
    expect(can("INVENTORY_MANAGER", "inventory:adjust")).toBe(true);
    expect(can("INVENTORY_MANAGER", "order:refund")).toBe(false);
    expect(can("INVENTORY_MANAGER", "product:write")).toBe(false);
    expect(can("STORE_MANAGER", "order:refund")).toBe(true);
    expect(can("STORE_MANAGER", "settings:write")).toBe(false);
    expect(can("STORE_MANAGER", "product:view-cost")).toBe(false);
    expect(can("ADMIN", "product:view-cost")).toBe(true);
    expect(can("ADMIN", "staff:manage")).toBe(true);
    expect(can(null, "dashboard:view")).toBe(false);
  });

  it("assertPermission throws the right errors", () => {
    expect(() => assertPermission(null, "order:read")).toThrow(UnauthorizedError);
    expect(() => assertPermission({ id: "1", role: "CUSTOMER", email: "a@b.c", name: "A" }, "order:read")).toThrow(ForbiddenError);
    expect(() => assertPermission({ id: "1", role: "STORE_MANAGER", email: "a@b.c", name: "A" }, "order:read")).not.toThrow();
  });
});

describe("order state machine", () => {
  it("allows only forward transitions and cancellation before shipping", () => {
    expect(canStaffTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(canStaffTransition("PENDING", "SHIPPED")).toBe(false);
    expect(canStaffTransition("PACKED", "CANCELLED")).toBe(true);
    expect(canStaffTransition("SHIPPED", "CANCELLED")).toBe(false);
    expect(canStaffTransition("SHIPPED", "RETURNED")).toBe(true);
    expect(canStaffTransition("DELIVERED", "PENDING")).toBe(false);
    expect(STAFF_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("lets customers cancel only pending or confirmed orders", () => {
    expect(canCustomerCancel("PENDING")).toBe(true);
    expect(canCustomerCancel("CONFIRMED")).toBe(true);
    expect(canCustomerCancel("PROCESSING")).toBe(false);
    expect(canCustomerCancel("SHIPPED")).toBe(false);
  });
});
