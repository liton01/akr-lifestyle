import type {
  BannerPlacement,
  DiscountScope,
  DiscountType,
  CouponScope,
  InventoryMovementType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  RefundMethod,
  ReturnStatus,
} from "@prisma/client";

/** The 64 districts of Bangladesh grouped by division. */
export const BD_DIVISIONS: Record<string, readonly string[]> = {
  Dhaka: ["Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Kishoreganj", "Madaripur", "Manikganj", "Munshiganj", "Narayanganj", "Narsingdi", "Rajbari", "Shariatpur", "Tangail"],
  Chattogram: ["Bandarban", "Brahmanbaria", "Chandpur", "Chattogram", "Cox's Bazar", "Cumilla", "Feni", "Khagrachhari", "Lakshmipur", "Noakhali", "Rangamati"],
  Rajshahi: ["Bogura", "Chapainawabganj", "Joypurhat", "Naogaon", "Natore", "Pabna", "Rajshahi", "Sirajganj"],
  Khulna: ["Bagerhat", "Chuadanga", "Jashore", "Jhenaidah", "Khulna", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira"],
  Barishal: ["Barguna", "Barishal", "Bhola", "Jhalokathi", "Patuakhali", "Pirojpur"],
  Sylhet: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
  Rangpur: ["Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon"],
  Mymensingh: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
};

export const BD_DISTRICTS: readonly string[] = Object.values(BD_DIVISIONS).flat().sort((a, b) => a.localeCompare(b));

export function isKnownDistrict(name: string): boolean {
  return BD_DISTRICTS.some((d) => d.toLowerCase() === name.trim().toLowerCase());
}

export function canonicalDistrict(name: string): string | null {
  return BD_DISTRICTS.find((d) => d.toLowerCase() === name.trim().toLowerCase()) ?? null;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  COD: "Cash on delivery",
  SSLCOMMERZ: "Online payment (SSLCommerz)",
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
};

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RECEIVED: "Received",
  CLOSED: "Closed",
};

export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  CASH: "Cash",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
  BANK_TRANSFER: "Bank transfer",
  GATEWAY: "Payment gateway",
  OTHER: "Other",
};

export const MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  INITIAL_STOCK: "Initial stock",
  ORDER_PLACED: "Order placed",
  ORDER_CANCELLED: "Order cancelled",
  RETURN_RESTOCK: "Return restocked",
  MANUAL_ADJUSTMENT: "Manual adjustment",
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: "Percentage",
  FIXED_AMOUNT: "Fixed amount",
};

export const DISCOUNT_SCOPE_LABELS: Record<DiscountScope, string> = {
  STORE_WIDE: "Store-wide",
  PRODUCT: "Specific products",
  CATEGORY: "Specific categories",
  BRAND: "Specific brands",
};

export const COUPON_SCOPE_LABELS: Record<CouponScope, string> = {
  ORDER: "Whole order",
  PRODUCT: "Specific products",
  CATEGORY: "Specific categories",
};

export const BANNER_PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  HOME_HERO: "Homepage hero slider",
  HOME_PROMO: "Homepage promo tiles",
  HOME_STRIP: "Homepage wide strip",
  OFFERS_PAGE: "Offers page",
};

export const PAGE_SIZE = 24;
export const ADMIN_PAGE_SIZE = 20;
export const MAX_CART_LINE_QUANTITY = 20;
export const MAX_CATEGORY_DEPTH = 3;
