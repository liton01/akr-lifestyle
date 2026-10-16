import Link from "next/link";
import { SETTINGS_TABS } from "@/components/admin/settings-config";
import { SettingsForm } from "@/components/admin/settings-form";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { Alert } from "@/components/ui/feedback";
import { cn, firstParam } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { isSslcommerzConfigured } from "@/server/env";
import { notificationStatus } from "@/server/notifications/providers";
import { loadStoreSettings } from "@/server/services/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  await requireStaffPage("settings:write", "/admin/settings");
  const params = await searchParams;
  const tab = SETTINGS_TABS.find((t) => t.group === firstParam(params.tab)) ?? SETTINGS_TABS[0]!;
  // Read directly (not from cache) so the editor always shows the stored values.
  const settings = await loadStoreSettings(prisma);
  const providers = notificationStatus();

  return (
    <>
      <AdminPageHeader title="Settings" description="Changes apply immediately across the store." />
      <nav aria-label="Settings sections" className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {SETTINGS_TABS.map((t) => (
          <Link
            key={t.group}
            href={`/admin/settings?tab=${t.group}`}
            aria-current={t.group === tab.group ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-4 py-2 text-sm", t.group === tab.group ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab.group === "commerce" ? (
        <Alert tone="info" className="mb-6" title="Integration status (server environment)">
          SSLCommerz: {isSslcommerzConfigured() ? "credentials configured" : "not configured — online payment is hidden at checkout"}. Email: {providers.email.provider}
          {providers.email.delivers ? "" : " (not delivering)"}. SMS: {providers.sms.provider}
          {providers.sms.delivers ? "" : " (not configured)"}. Delivery fees are managed under{" "}
          <Link href="/admin/delivery" className="link">
            Delivery zones
          </Link>
          .
        </Alert>
      ) : null}
      <Panel title={tab.label} description={tab.description} className="max-w-4xl">
        <SettingsForm key={tab.group} group={tab.group} fields={tab.fields} initial={settings[tab.group] as Record<string, unknown>} />
      </Panel>
    </>
  );
}
