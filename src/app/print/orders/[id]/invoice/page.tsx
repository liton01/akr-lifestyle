import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/admin/print-documents";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { getAdminOrder } from "@/server/services/orders";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: PageProps<"/print/orders/[id]/invoice">) {
  const { id } = await params;
  await requireStaffPage("order:read", `/admin/orders/${id}`);
  const [order, settings] = await Promise.all([getAdminOrder(prisma, id), getSettings()]);
  if (!order) notFound();
  return <InvoiceDocument order={order} settings={settings} />;
}
