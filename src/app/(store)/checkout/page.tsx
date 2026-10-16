import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/store/catalog";
import { CheckoutForm } from "@/components/store/checkout-form";
import { Alert } from "@/components/ui/feedback";
import { BD_DISTRICTS } from "@/lib/constants";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { getCartOwner } from "@/server/cart-session";
import { prisma } from "@/server/db";
import { isSslcommerzConfigured } from "@/server/env";
import { getCartView } from "@/server/services/cart";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  if (!user && !settings.commerce.guestCheckoutEnabled) redirect("/login?next=/checkout");

  const [addresses, profile] = user
    ? await Promise.all([
        prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
        prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { phone: true } }),
      ])
    : [[], null];
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const district = defaultAddress?.district ?? "";

  const owner = await getCartOwner();
  const cart = await getCartView(prisma, owner, {
    district: district || null,
    customer: { userId: user?.id ?? null, phone: defaultAddress?.phone ?? profile?.phone ?? null },
    freeDeliveryEnabled: settings.commerce.freeDeliveryEnabled,
    maxPerLine: settings.commerce.maxQuantityPerLine,
  });
  if (cart.lines.length === 0) redirect("/cart");

  const onlineAvailable = settings.commerce.onlinePaymentEnabled && isSslcommerzConfigured();

  return (
    <div className="container-page py-8 lg:py-12">
      <PageHeader breadcrumbs={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]} title="Checkout" />
      {settings.commerce.onlinePaymentEnabled && !isSslcommerzConfigured() && user && user.role !== "CUSTOMER" ? (
        <Alert tone="info" className="mt-6">
          Online payment is enabled in settings but SSLCommerz credentials are not configured, so only cash on delivery is offered. (Visible to staff only.)
        </Alert>
      ) : null}
      <div className="mt-8">
        <CheckoutForm
          districts={BD_DISTRICTS}
          addresses={addresses.map((a) => ({
            id: a.id,
            label: a.label,
            fullName: a.fullName,
            phone: a.phone,
            district: a.district,
            area: a.area,
            addressLine: a.addressLine,
            postalCode: a.postalCode,
            isDefault: a.isDefault,
          }))}
          defaults={{ fullName: user?.name ?? "", phone: profile?.phone ?? "", email: user?.email ?? "" }}
          initialDistrict={district}
          initialQuote={{
            totals: cart.totals,
            couponCode: cart.coupon?.code ?? cart.couponCode,
            couponError: cart.couponError,
            delivery: {
              zoneName: cart.delivery.zone?.name ?? null,
              estimatedDays: cart.delivery.zone?.estimatedDays ?? null,
              freeDeliveryApplied: cart.delivery.freeDeliveryApplied,
              amountToFreeDelivery: cart.delivery.amountToFreeDelivery,
            },
            issues: cart.lines.filter((l) => l.issue).map((l) => `${l.productName}: ${l.issue}`),
          }}
          lines={cart.lines.map((l) => ({
            id: l.itemId,
            name: l.productName,
            variant: l.variantName,
            quantity: l.quantity,
            imageUrl: l.imageUrl,
            lineSubtotal: l.lineSubtotal,
          }))}
          payment={{ cod: settings.commerce.codEnabled, online: onlineAvailable }}
          signedIn={Boolean(user)}
        />
      </div>
    </div>
  );
}
