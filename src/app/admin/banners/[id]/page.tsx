import { notFound } from "next/navigation";
import { BannerForm, type BannerValues } from "@/components/admin/promo-forms";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { requireStaffPage } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const metadata = { title: "Banner" };

export default async function BannerEditPage({ params }: PageProps<"/admin/banners/[id]">) {
  const { id } = await params;
  await requireStaffPage("promotion:write", `/admin/banners/${id}`);
  const banner = id === "new" ? null : await prisma.banner.findUnique({ where: { id } });
  if (id !== "new" && !banner) notFound();
  const initial: BannerValues = banner
    ? {
        id: banner.id,
        title: banner.title,
        subtitle: banner.subtitle ?? "",
        imageUrl: banner.imageUrl,
        mobileImageUrl: banner.mobileImageUrl ?? "",
        linkUrl: banner.linkUrl ?? "",
        ctaLabel: banner.ctaLabel ?? "",
        placement: banner.placement,
        sortOrder: banner.sortOrder,
        isActive: banner.isActive,
        startsAt: banner.startsAt?.toISOString() ?? null,
        endsAt: banner.endsAt?.toISOString() ?? null,
      }
    : { id: null, title: "", subtitle: "", imageUrl: "", mobileImageUrl: "", linkUrl: "", ctaLabel: "", placement: "HOME_PROMO", sortOrder: 0, isActive: true, startsAt: null, endsAt: null };
  return (
    <>
      <AdminPageHeader title={banner ? banner.title : "New banner"} back={{ href: "/admin/banners", label: "Banners" }} />
      <Panel className="max-w-3xl">
        <BannerForm initial={initial} />
      </Panel>
    </>
  );
}
