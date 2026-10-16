import { Plus } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPageHeader, EmptyRow, Table, Td, Th } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { COUPON_SCOPE_LABELS } from "@/lib/constants";
import { formatBDT, toMinor } from "@/lib/money";
import { firstParam, isWithinWindow } from "@/lib/utils";
import { deleteCouponAction } from "@/server/actions/admin/store";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";

export const metadata = { title: "Coupons" };

export default async function CouponsPage({ searchParams }: PageProps<"/admin/coupons">) {
  await requireStaffPage("promotion:write", "/admin/coupons");
  const params = await searchParams;
  const [settings, coupons] = await Promise.all([getSettings(), prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { usages: true } } } })]);
  const now = new Date();
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: settings.general.timeZone }) : "—");
  return (
    <>
      <AdminPageHeader
        title="Coupons"
        description="One coupon per order. Coupons apply after sale and promotion prices; usage limits are enforced atomically at checkout."
        actions={
          <ButtonLink href="/admin/coupons/new">
            <Plus className="h-4 w-4" /> New coupon
          </ButtonLink>
        }
      />
      {firstParam(params.saved) ? <Alert tone="success" className="mb-4">Coupon saved.</Alert> : null}
      <Table>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Discount</Th>
            <Th>Rules</Th>
            <Th>Validity</Th>
            <Th align="right">Used</Th>
            <Th>Status</Th>
            <Th align="right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {coupons.length ? (
            coupons.map((c) => {
              const exhausted = c.usageLimit !== null && c.usedCount >= c.usageLimit;
              const live = c.isActive && isWithinWindow(now, c.startsAt, c.endsAt) && !exhausted;
              return (
                <tr key={c.id} className="hover:bg-ivory/40">
                  <Td>
                    <Link href={`/admin/coupons/${c.id}`} className="font-mono font-semibold hover:underline">
                      {c.code}
                    </Link>
                    {c.description ? <span className="block text-xs text-muted">{c.description}</span> : null}
                  </Td>
                  <Td>
                    {c.type === "PERCENTAGE" ? `${c.value.toString()}%` : formatBDT(toMinor(c.value))}
                    {c.maxDiscountAmount ? <span className="block text-xs text-muted">max {formatBDT(toMinor(c.maxDiscountAmount))}</span> : null}
                  </Td>
                  <Td className="text-xs">
                    {COUPON_SCOPE_LABELS[c.scope]}
                    {c.minOrderAmount ? ` · min ${formatBDT(toMinor(c.minOrderAmount))}` : ""}
                    {c.newCustomersOnly ? " · first order" : ""}
                    {!c.appliesToSaleItems ? " · excl. sale items" : ""}
                    {c.perCustomerLimit ? ` · ${c.perCustomerLimit}/customer` : ""}
                  </Td>
                  <Td className="text-xs text-muted">
                    {fmt(c.startsAt)} → {fmt(c.endsAt)}
                  </Td>
                  <Td align="right">
                    {c.usedCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                  </Td>
                  <Td>{live ? <Badge tone="success">Live</Badge> : exhausted ? <Badge tone="warning">Used up</Badge> : c.isActive ? <Badge>Not in window</Badge> : <Badge>Inactive</Badge>}</Td>
                  <Td align="right">
                    {c._count.usages === 0 ? (
                      <ActionButton action={deleteCouponAction} fields={{ id: c.id }} variant="ghost" confirm={{ title: `Delete ${c.code}?`, confirmLabel: "Delete" }}>
                        Delete
                      </ActionButton>
                    ) : null}
                  </Td>
                </tr>
              );
            })
          ) : (
            <EmptyRow colSpan={7}>No coupons yet.</EmptyRow>
          )}
        </tbody>
      </Table>
    </>
  );
}
