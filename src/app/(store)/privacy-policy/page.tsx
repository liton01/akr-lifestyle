import type { Metadata } from "next";
import { ContentPage } from "@/components/store/content-page";
import { getSettings } from "@/server/cache";

export const metadata: Metadata = { title: "Privacy policy" };

export default async function PrivacyPolicyPage() {
  const { content } = await getSettings();
  return <ContentPage title="Privacy policy" eyebrow="Legal" content={content.privacyPolicy} />;
}
