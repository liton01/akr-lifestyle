import { notFound } from "next/navigation";
import { DiscountForm, type DiscountValues } from "@/components/admin/promo-forms";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { minorToInput, toMinor, toMinorOrNull } from "@/lib/money";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { loadTargetOptions } from "../../promo-options";

export const metadata = { title: "Promotion" };

export default async function DiscountEditPage({ params }: PageProps<"/admin/discounts/[id]">) {
  const { id } = await params;
  await requireStaffPage("promotion:write", `/admin/discounts/${id}`);
  const isNew = id === "new";
  const [discount, options] = await Promise.all([
    isNew
      ? null
      : prisma.discount.findUnique({ where: { id }, include: { products: { select: { id: true } }, categories: { select: { id: true } }, brands: { select: { id: true } } } }),
    loadTargetOptions(),
  ]);
  if (!isNew && !discount) notFound();
  const initial: DiscountValues = discount
    ? {
        id: discount.id,
        name: discount.name,
        description: discount.description ?? "",
        type: discount.type,
        value: minorToInput(toMinor(discount.value)),
        scope: discount.scope,
        maxDiscountAmount: minorToInput(toMinorOrNull(discount.maxDiscountAmount)),
        badgeLabel: discount.badgeLabel ?? "",
        startsAt: discount.startsAt?.toISOString() ?? null,
        endsAt: discount.endsAt?.toISOString() ?? null,
        isActive: discount.isActive,
        productIds: discount.products.map((p) => p.id),
        categoryIds: discount.categories.map((c) => c.id),
        brandIds: discount.brands.map((b) => b.id),
      }
    : {
        id: null,
        name: "",
        description: "",
        type: "PERCENTAGE",
        value: "",
        scope: "STORE_WIDE",
        maxDiscountAmount: "",
        badgeLabel: "",
        startsAt: null,
        endsAt: null,
        isActive: true,
        productIds: [],
        categoryIds: [],
        brandIds: [],
      };
  return (
    <>
      <AdminPageHeader title={discount ? discount.name : "New promotion"} back={{ href: "/admin/discounts", label: "Promotions" }} />
      <Panel className="max-w-3xl">
        <DiscountForm initial={initial} {...options} />
      </Panel>
    </>
  );
}
