import type { Metadata } from "next";
import { AddressCard, NewAddressPanel } from "@/components/account/account-forms";
import { EmptyState } from "@/components/ui/feedback";
import { BD_DISTRICTS } from "@/lib/constants";
import { requireUserPage } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { listOwnAddresses } from "@/server/services/customers";

export const metadata: Metadata = { title: "Addresses", robots: { index: false } };

export default async function AddressesPage() {
  const user = await requireUserPage("/account/addresses");
  const addresses = await listOwnAddresses(prisma, user.id);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Address book</h2>
      </div>
      {addresses.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id}>
              <AddressCard
                districts={BD_DISTRICTS}
                address={{
                  id: a.id,
                  label: a.label ?? "",
                  fullName: a.fullName,
                  phone: a.phone,
                  district: a.district,
                  area: a.area,
                  addressLine: a.addressLine,
                  postalCode: a.postalCode ?? "",
                  isDefault: a.isDefault,
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No saved addresses" description="Save an address for faster checkout." />
      )}
      {addresses.length < 10 ? <NewAddressPanel districts={BD_DISTRICTS} /> : null}
    </div>
  );
}
