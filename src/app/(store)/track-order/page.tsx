import type { Metadata } from "next";
import { PageHeader } from "@/components/store/catalog";
import { TrackOrderForm } from "@/components/store/public-forms";
import { getSettings } from "@/server/cache";

export const metadata: Metadata = { title: "Track your order" };

export default async function TrackOrderPage() {
  const settings = await getSettings();
  return (
    <div className="container-page max-w-4xl py-8 lg:py-12">
      <PageHeader
        breadcrumbs={[{ label: "Track order" }]}
        eyebrow="Order status"
        title="Track your order"
        description="Enter your order number (from your confirmation) and the phone number used at checkout."
      />
      <div className="mt-8">
        <TrackOrderForm timeZone={settings.general.timeZone} />
      </div>
    </div>
  );
}
