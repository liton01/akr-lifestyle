import { toCsv } from "@/lib/csv";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { listInventory, stockState } from "@/server/services/inventory";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "reports:inventory")) return new Response("Forbidden", { status: 403 });
  const { rows } = await listInventory(prisma, { stock: "all", sort: "name", page: 1, pageSize: 100_000 });
  const csv = toCsv(
    ["Product", "Variant", "SKU", "Category", "Product status", "Quantity", "Low-stock threshold", "Stock state"],
    rows.map((r) => [r.productName, r.isDefault ? "" : r.variantName, r.sku, r.categoryName, r.productStatus, r.quantity, r.threshold, stockState(r.quantity, r.threshold)]),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="inventory-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
