import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/store/catalog";
import { ContactForm } from "@/components/store/public-forms";
import { getSettings } from "@/server/cache";

export const metadata: Metadata = { title: "Contact us" };

export default async function ContactPage() {
  const { general, content } = await getSettings();
  const whatsapp = general.whatsappNumber.replace(/\D/g, "");
  return (
    <div className="container-page py-8 lg:py-14">
      <PageHeader breadcrumbs={[{ label: "Contact" }]} eyebrow="We are here to help" title="Contact us" description={content.contactIntro} />
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <section className="card p-6 sm:p-8" aria-label="Contact form">
          <ContactForm />
        </section>
        <aside className="space-y-5 text-sm">
          {general.contactPhone ? (
            <p className="flex gap-3">
              <Phone className="h-5 w-5 shrink-0 text-gold-dark" aria-hidden="true" />
              <a href={`tel:${general.contactPhone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                {general.contactPhone}
              </a>
            </p>
          ) : null}
          {whatsapp ? (
            <p className="flex gap-3">
              <MessageCircle className="h-5 w-5 shrink-0 text-gold-dark" aria-hidden="true" />
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                Chat on WhatsApp
              </a>
            </p>
          ) : null}
          <p className="flex gap-3">
            <Mail className="h-5 w-5 shrink-0 text-gold-dark" aria-hidden="true" />
            <a href={`mailto:${general.contactEmail}`} className="break-all hover:underline">
              {general.contactEmail}
            </a>
          </p>
          {general.businessAddress ? (
            <p className="flex gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-gold-dark" aria-hidden="true" />
              {general.businessAddress}
            </p>
          ) : null}
          {general.businessHours ? (
            <p className="flex gap-3">
              <Clock className="h-5 w-5 shrink-0 text-gold-dark" aria-hidden="true" />
              {general.businessHours}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
