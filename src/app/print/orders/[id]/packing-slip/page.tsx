import { notFound } from "next/navigation";
import { PackingSlipDocument } from "@/components/admin/print-documents";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";
import { getAdminOrder } from "@/server/services/orders";

export const metadata = { title: "Packing slip" };

export default async function PackingSlipPage({ params }: PageProps<"/print/orders/[id]/packing-slip">) {
  const { id } = await params;
  await requireStaffPage("order:read", `/admin/orders/${id}`);
  const [order, settings] = await Promise.all([getAdminOrder(prisma, id), getSettings()]);
  if (!order) notFound();
  return <PackingSlipDocument order={order} settings={settings} />;
}
