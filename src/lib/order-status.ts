import type { OrderStatus } from "@prisma/client";

/**
 * Order lifecycle.
 *
 *   PENDING ─▶ CONFIRMED ─▶ PROCESSING ─▶ PACKED ─▶ SHIPPED ─▶ DELIVERED ─▶ RETURNED*
 *      │           │             │           │          └──▶ RETURNED (failed delivery / refused)
 *      └───────────┴─────────────┴───────────┴──▶ CANCELLED
 *
 * *DELIVERED ─▶ RETURNED happens through approved return requests once every item is returned.
 *
 * Stock policy: stock is deducted when the order is placed. It is restored exactly once on
 * cancellation or on SHIPPED ─▶ RETURNED (guarded by Order.stockRestoredAt), and per return
 * request when returned goods are received (guarded by ReturnRequest.restockedAt).
 */
export const STAFF_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

/** Customers may cancel their own order only before it is being processed. */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ["PENDING", "CONFIRMED"];

export const OPEN_STATUSES: readonly OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED"];

export function canStaffTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STAFF_TRANSITIONS[from].includes(to);
}

export function canCustomerCancel(status: OrderStatus): boolean {
  return CUSTOMER_CANCELLABLE.includes(status);
}

/** Steps displayed on the customer tracking timeline. */
export const TRACKING_STEPS: readonly OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"];

export function trackingStepIndex(status: OrderStatus): number {
  return TRACKING_STEPS.indexOf(status);
}
