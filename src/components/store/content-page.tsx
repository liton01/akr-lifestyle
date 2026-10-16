import type { ReactNode } from "react";
import { PageHeader } from "@/components/store/catalog";
import { RichText } from "@/components/ui/rich-text";

export function ContentPage({ title, eyebrow, content, children }: { title: string; eyebrow?: string; content?: string; children?: ReactNode }) {
  return (
    <div className="container-page max-w-3xl py-8 lg:py-14">
      <PageHeader breadcrumbs={[{ label: title }]} eyebrow={eyebrow} title={title} />
      {content ? <RichText content={content} className="mt-8" /> : null}
      {children}
    </div>
  );
}
