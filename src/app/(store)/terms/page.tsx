import type { Metadata } from "next";
import { ContentPage } from "@/components/store/content-page";
import { getSettings } from "@/server/cache";

export const metadata: Metadata = { title: "Terms & conditions" };

export default async function TermsPage() {
  const { content } = await getSettings();
  return <ContentPage title="Terms & conditions" eyebrow="Legal" content={content.terms} />;
}
