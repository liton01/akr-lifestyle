import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/store/content-page";
import { getSettings } from "@/server/cache";

export const metadata: Metadata = { title: "Frequently asked questions" };

export default async function FaqPage() {
  const { content } = await getSettings();
  return (
    <ContentPage title="Frequently asked questions" eyebrow="Help centre">
      <div className="mt-8 divide-y divide-line border-y border-line">
        {content.faqs.map((faq) => (
          <details key={faq.question} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium">
              {faq.question}
              <span className="text-xl text-gold-dark transition-transform group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-charcoal">{faq.answer}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 text-sm text-charcoal">
        Still have a question?{" "}
        <Link href="/contact" className="link">
          Contact our team
        </Link>
        .
      </p>
    </ContentPage>
  );
}
