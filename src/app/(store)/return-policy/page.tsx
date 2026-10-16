import type { Metadata } from "next";
import { ContentPage } from "@/components/store/content-page";
import { RichText } from "@/components/ui/rich-text";
import { getSettings } from "@/server/cache";

export const metadata: Metadata = { title: "Returns & refunds" };

export default async function ReturnPolicyPage() {
  const { content } = await getSettings();
  return (
    <ContentPage title="Returns & refunds" eyebrow="Customer care" content={content.returnPolicy}>
      <section className="mt-10 border-t border-line pt-8" aria-labelledby="refund-heading">
        <h2 id="refund-heading" className="text-3xl font-semibold">
          Refund policy
        </h2>
        <RichText content={content.refundPolicy} className="mt-4" />
      </section>
    </ContentPage>
  );
}
