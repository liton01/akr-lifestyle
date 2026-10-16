import type { Metadata } from "next";
import { ContentPage } from "@/components/store/content-page";
import { formatBDT, toMinor } from "@/lib/money";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Shipping policy" };

export default async function ShippingPolicyPage() {
  const [{ content, commerce }, zones] = await Promise.all([
    getSettings(),
    prisma.deliveryZone.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  return (
    <ContentPage title="Shipping policy" eyebrow="Delivery" content={content.shippingPolicy}>
      {zones.length ? (
        <section className="mt-10" aria-labelledby="rates-heading">
          <h2 id="rates-heading" className="text-2xl font-semibold">
            Current delivery charges
          </h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-ivory/70 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Zone
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Charge
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Free delivery over
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Estimated time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {zones.map((zone) => (
                  <tr key={zone.id}>
                    <th scope="row" className="px-4 py-3 font-medium">
                      {zone.name}
                      <span className="block text-xs font-normal text-muted">{zone.isDefault ? "All other districts" : zone.districts.join(", ")}</span>
                    </th>
                    <td className="px-4 py-3">{formatBDT(toMinor(zone.fee))}</td>
                    <td className="px-4 py-3">
                      {commerce.freeDeliveryEnabled && zone.freeDeliveryThreshold ? formatBDT(toMinor(zone.freeDeliveryThreshold)) : "—"}
                    </td>
                    <td className="px-4 py-3">{zone.estimatedDays ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </ContentPage>
  );
}
