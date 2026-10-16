import type { BannerPlacement } from "@prisma/client";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { BANNER_PLACEMENT_LABELS } from "@/lib/constants";
import { firstParam, isWithinWindow } from "@/lib/utils";
import { bannerCommandAction } from "@/server/actions/admin/store";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const metadata = { title: "Banners" };

export default async function BannersPage({ searchParams }: PageProps<"/admin/banners">) {
  await requireStaffPage("promotion:write", "/admin/banners");
  const params = await searchParams;
  const banners = await prisma.banner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
  const now = new Date();
  const groups = (Object.keys(BANNER_PLACEMENT_LABELS) as BannerPlacement[]).map((placement) => ({ placement, items: banners.filter((b) => b.placement === placement) }));
  return (
    <>
      <AdminPageHeader
        title="Promotional banners"
        description="Create, schedule, reorder and switch banners on or off."
        actions={
          <ButtonLink href="/admin/banners/new">
            <Plus className="h-4 w-4" /> New banner
          </ButtonLink>
        }
      />
      {firstParam(params.saved) ? <Alert tone="success" className="mb-4">Banner saved.</Alert> : null}
      {banners.length === 0 ? <EmptyState title="No banners yet" /> : null}
      <div className="space-y-6">
        {groups
          .filter((g) => g.items.length)
          .map((group) => (
            <Panel key={group.placement} title={BANNER_PLACEMENT_LABELS[group.placement]}>
              <ul className="divide-y divide-line">
                {group.items.map((banner, index) => {
                  const live = banner.isActive && isWithinWindow(now, banner.startsAt, banner.endsAt);
                  return (
                    <li key={banner.id} className="flex flex-wrap items-center gap-4 py-3">
                      <div className="relative h-16 w-28 overflow-hidden rounded-md bg-ivory">
                        <Image src={banner.imageUrl} alt="" fill sizes="112px" className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/banners/${banner.id}`} className="font-medium hover:underline">
                          {banner.title}
                        </Link>
                        <p className="truncate text-xs text-muted">
                          {banner.linkUrl ?? "No link"}
                          {banner.endsAt ? ` · until ${banner.endsAt.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}` : ""}
                        </p>
                      </div>
                      {live ? <Badge tone="success">Showing</Badge> : banner.isActive ? <Badge tone="info">Scheduled / ended</Badge> : <Badge>Off</Badge>}
                      <div className="flex flex-wrap items-center gap-1">
                        <ActionButton action={bannerCommandAction} fields={{ id: banner.id, command: "up" }} variant="ghost" className={index === 0 ? "invisible" : ""}>
                          <ArrowUp className="h-4 w-4" />
                          <span className="sr-only">Move up</span>
                        </ActionButton>
                        <ActionButton action={bannerCommandAction} fields={{ id: banner.id, command: "down" }} variant="ghost" className={index === group.items.length - 1 ? "invisible" : ""}>
                          <ArrowDown className="h-4 w-4" />
                          <span className="sr-only">Move down</span>
                        </ActionButton>
                        <ActionButton action={bannerCommandAction} fields={{ id: banner.id, command: banner.isActive ? "deactivate" : "activate" }}>
                          {banner.isActive ? "Turn off" : "Turn on"}
                        </ActionButton>
                        <ActionButton action={bannerCommandAction} fields={{ id: banner.id, command: "delete" }} variant="ghost" confirm={{ title: "Delete this banner?", confirmLabel: "Delete" }}>
                          Delete
                        </ActionButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
      </div>
    </>
  );
}
