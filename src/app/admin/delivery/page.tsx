import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { NewZonePanel, ZoneEditor } from "@/components/admin/zone-list";
import { Alert, Badge } from "@/components/ui/feedback";
import { BD_DISTRICTS } from "@/lib/constants";
import { formatBDT, minorToInput, toMinor, toMinorOrNull } from "@/lib/money";
import { deleteDeliveryZoneAction } from "@/server/actions/admin/store";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/cache";
import { prisma } from "@/server/db";

export const metadata = { title: "Delivery zones" };

export default async function DeliveryPage() {
  await requireStaffPage("delivery:write", "/admin/delivery");
  const [zones, settings] = await Promise.all([prisma.deliveryZone.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }), getSettings()]);
  const covered = new Set(zones.filter((z) => z.isActive).flatMap((z) => z.districts));
  const hasDefault = zones.some((z) => z.isDefault && z.isActive);
  return (
    <>
      <AdminPageHeader title="Delivery zones" description="Delivery charges are calculated on the server from the customer's district." />
      <Alert tone={settings.commerce.freeDeliveryEnabled ? "info" : "warning"} className="mb-6">
        Free delivery thresholds are currently <strong>{settings.commerce.freeDeliveryEnabled ? "enabled" : "disabled"}</strong>. Change this in{" "}
        <Link href="/admin/settings?tab=commerce" className="link">
          Settings → Checkout
        </Link>
        .
      </Alert>
      {!hasDefault ? (
        <Alert tone="warning" className="mb-6">
          No active default zone — customers in uncovered districts ({BD_DISTRICTS.length - covered.size}) cannot check out.
        </Alert>
      ) : null}
      <div className="space-y-4">
        {zones.map((zone) => (
          <Panel key={zone.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  {zone.name} {zone.isDefault ? <Badge tone="gold">Default</Badge> : null} {!zone.isActive ? <Badge>Inactive</Badge> : null}
                </p>
                <p className="mt-1 text-sm">
                  Fee <strong>{formatBDT(toMinor(zone.fee))}</strong>
                  {zone.freeDeliveryThreshold ? ` · free over ${formatBDT(toMinor(zone.freeDeliveryThreshold))}` : ""}
                  {zone.estimatedDays ? ` · ${zone.estimatedDays}` : ""}
                </p>
                <p className="mt-1 max-w-2xl text-xs text-muted">{zone.isDefault ? "All districts not listed in another zone" : zone.districts.join(", ")}</p>
              </div>
              <div className="flex gap-2">
                <ActionButton action={deleteDeliveryZoneAction} fields={{ id: zone.id }} variant="ghost" confirm={{ title: `Delete ${zone.name}?`, confirmLabel: "Delete" }}>
                  Delete
                </ActionButton>
              </div>
              <ZoneEditor
                districts={BD_DISTRICTS}
                zone={{
                  id: zone.id,
                  name: zone.name,
                  districts: zone.districts,
                  fee: minorToInput(toMinor(zone.fee)),
                  freeDeliveryThreshold: minorToInput(toMinorOrNull(zone.freeDeliveryThreshold)),
                  estimatedDays: zone.estimatedDays ?? "",
                  isDefault: zone.isDefault,
                  isActive: zone.isActive,
                  sortOrder: zone.sortOrder,
                }}
              />
            </div>
          </Panel>
        ))}
        <NewZonePanel districts={BD_DISTRICTS} />
      </div>
    </>
  );
}
