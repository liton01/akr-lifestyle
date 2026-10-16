import { Plus } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPageHeader, EmptyRow, Table, Td, Th } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { DISCOUNT_SCOPE_LABELS } from "@/lib/constants";
import { formatBDT, toMinor } from "@/lib/money";
import { firstParam, isWithinWindow } from "@/lib/utils";
import { deleteDiscountAction } from "@/server/actions/admin/store";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";

export const metadata = { title: "Promotions" };

export default async function DiscountsPage({ searchParams }: PageProps<"/admin/discounts">) {
  await requireStaffPage("promotion:write", "/admin/discounts");
  const params = await searchParams;
  const [settings, discounts] = await Promise.all([
    getSettings(),
    prisma.discount.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { products: true, categories: true, brands: true } } } }),
  ]);
  const now = new Date();
  const fmt = (d: Date | null) => (d ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: settings.general.timeZone }) : "—");
  return (
    <>
      <AdminPageHeader
        title="Automatic promotions"
        description="Applied without a code. Each item gets the single best price among its regular price, scheduled sale and live promotions — promotions never stack."
        actions={
          <ButtonLink href="/admin/discounts/new">
            <Plus className="h-4 w-4" /> New promotion
          </ButtonLink>
        }
      />
      {firstParam(params.saved) ? <Alert tone="success" className="mb-4">Promotion saved.</Alert> : null}
      <Table>
        <thead>
          <tr>
            <Th>Promotion</Th>
            <Th>Discount</Th>
            <Th>Applies to</Th>
            <Th>Schedule</Th>
            <Th>Status</Th>
            <Th align="right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {discounts.length ? (
            discounts.map((d) => {
              const live = d.isActive && isWithinWindow(now, d.startsAt, d.endsAt);
              const scheduled = d.isActive && d.startsAt !== null && d.startsAt > now;
              return (
                <tr key={d.id} className="hover:bg-ivory/40">
                  <Td>
                    <Link href={`/admin/discounts/${d.id}`} className="font-medium hover:underline">
                      {d.name}
                    </Link>
                    {d.badgeLabel ? <span className="block text-xs text-gold-deep">{d.badgeLabel}</span> : null}
                  </Td>
                  <Td>{d.type === "PERCENTAGE" ? `${d.value.toString()}%` : formatBDT(toMinor(d.value))}</Td>
                  <Td className="text-sm">
                    {DISCOUNT_SCOPE_LABELS[d.scope]}
                    {d.scope === "PRODUCT" ? ` (${d._count.products})` : d.scope === "CATEGORY" ? ` (${d._count.categories})` : d.scope === "BRAND" ? ` (${d._count.brands})` : ""}
                  </Td>
                  <Td className="text-xs text-muted">
                    {fmt(d.startsAt)} → {fmt(d.endsAt)}
                  </Td>
                  <Td>{live ? <Badge tone="success">Live</Badge> : scheduled ? <Badge tone="info">Scheduled</Badge> : d.isActive ? <Badge>Ended</Badge> : <Badge>Inactive</Badge>}</Td>
                  <Td align="right">
                    <ActionButton action={deleteDiscountAction} fields={{ id: d.id }} variant="ghost" confirm={{ title: `Delete “${d.name}”?`, description: "Past orders keep their prices.", confirmLabel: "Delete" }}>
                      Delete
                    </ActionButton>
                  </Td>
                </tr>
              );
            })
          ) : (
            <EmptyRow colSpan={6}>No promotions yet.</EmptyRow>
          )}
        </tbody>
      </Table>
    </>
  );
}
