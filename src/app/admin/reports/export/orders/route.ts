import { toCsv } from "@/lib/csv";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { resolvePeriod } from "@/server/services/period";
import { ordersForExport } from "@/server/services/reports";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "reports:view")) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const { general } = await getSettings();
  const period = resolvePeriod(
    { range: url.searchParams.get("range") ?? undefined, from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined },
    general.timeZone,
  );
  const rows = await ordersForExport(prisma, period.from, period.to);
  const csv = toCsv(
    ["Order", "Placed (UTC)", "Status", "Payment status", "Payment method", "Customer", "District", "Subtotal", "Item discounts", "Coupon discount", "Delivery", "Total", "Refunded"],
    rows.map((o) => [
      o.orderNumber,
      o.createdAt,
      o.status,
      o.paymentStatus,
      o.paymentMethod,
      o.customerName,
      o.shippingDistrict,
      o.subtotal.toFixed(2),
      o.itemDiscountTotal.toFixed(2),
      o.couponDiscount.toFixed(2),
      o.deliveryFee.toFixed(2),
      o.total.toFixed(2),
      o.refundedAmount.toFixed(2),
    ]),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="orders-${period.fromInput}-to-${period.toInput}.csv"`,
      "cache-control": "no-store",
    },
  });
}
