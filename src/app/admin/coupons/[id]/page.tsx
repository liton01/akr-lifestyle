import { notFound } from "next/navigation";
import { CouponForm, type CouponValues } from "@/components/admin/promo-forms";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { minorToInput, toMinor, toMinorOrNull } from "@/lib/money";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { loadTargetOptions } from "../../promo-options";

export const metadata = { title: "Coupon" };

export default async function CouponEditPage({ params }: PageProps<"/admin/coupons/[id]">) {
  const { id } = await params;
  await requireStaffPage("promotion:write", `/admin/coupons/${id}`);
  const isNew = id === "new";
  const [coupon, options] = await Promise.all([
    isNew ? null : prisma.coupon.findUnique({ where: { id }, include: { products: { select: { id: true } }, categories: { select: { id: true } } } }),
    loadTargetOptions(),
  ]);
  if (!isNew && !coupon) notFound();
  const initial: CouponValues = coupon
    ? {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description ?? "",
        type: coupon.type,
        value: minorToInput(toMinor(coupon.value)),
        scope: coupon.scope,
        minOrderAmount: minorToInput(toMinorOrNull(coupon.minOrderAmount)),
        maxDiscountAmount: minorToInput(toMinorOrNull(coupon.maxDiscountAmount)),
        startsAt: coupon.startsAt?.toISOString() ?? null,
        endsAt: coupon.endsAt?.toISOString() ?? null,
        isActive: coupon.isActive,
        usageLimit: coupon.usageLimit?.toString() ?? "",
        perCustomerLimit: coupon.perCustomerLimit?.toString() ?? "",
        newCustomersOnly: coupon.newCustomersOnly,
        appliesToSaleItems: coupon.appliesToSaleItems,
        productIds: coupon.products.map((p) => p.id),
        categoryIds: coupon.categories.map((c) => c.id),
        usedCount: coupon.usedCount,
      }
    : {
        id: null,
        code: "",
        description: "",
        type: "PERCENTAGE",
        value: "",
        scope: "ORDER",
        minOrderAmount: "",
        maxDiscountAmount: "",
        startsAt: null,
        endsAt: null,
        isActive: true,
        usageLimit: "",
        perCustomerLimit: "1",
        newCustomersOnly: false,
        appliesToSaleItems: true,
        productIds: [],
        categoryIds: [],
        usedCount: 0,
      };
  return (
    <>
      <AdminPageHeader title={coupon ? coupon.code : "New coupon"} back={{ href: "/admin/coupons", label: "Coupons" }} />
      <Panel className="max-w-3xl">
        <CouponForm initial={initial} products={options.products} categories={options.categories} />
      </Panel>
    </>
  );
}
