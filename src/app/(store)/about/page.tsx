import type { Metadata } from "next";
import { ContentPage } from "@/components/store/content-page";
import { getSettings } from "@/server/cache";

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getSettings();
  return { title: content.aboutTitle };
}

export default async function AboutPage() {
  const { content, general } = await getSettings();
  return <ContentPage title={content.aboutTitle} eyebrow={general.slogan} content={content.aboutContent} />;
}
