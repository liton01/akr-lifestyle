import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import type { StoreSettings } from "@/lib/settings-schema";
import type { NavCategory } from "./header";
import { Logo } from "./logo";
import { FacebookIcon, InstagramIcon, LinkedinIcon, TiktokIcon, YoutubeIcon } from "./social-icons";

export function SiteFooter({ settings, nav }: { settings: StoreSettings; nav: NavCategory[] }) {
  const { general, social, footer } = settings;
  const socials = [
    { href: social.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: social.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: social.youtube, label: "YouTube", Icon: YoutubeIcon },
    { href: social.tiktok, label: "TikTok", Icon: TiktokIcon },
    { href: social.linkedin, label: "LinkedIn", Icon: LinkedinIcon },
  ].filter((s) => s.href);
  const whatsappDigits = general.whatsappNumber.replace(/\D/g, "");

  return (
    <footer className="theme-light mt-24 bg-ink text-ivory/80">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo storeName={general.storeName} logoUrl={general.logoUrl || undefined} inverted />
          <p className="mt-2 font-display text-lg italic text-gold">{general.slogan}</p>
          <p className="mt-4 max-w-sm text-sm leading-6">{footer.aboutText}</p>
          {socials.length ? (
            <ul className="mt-6 flex gap-2">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="grid h-9 w-9 place-items-center rounded-full border border-ivory/20 hover:border-gold hover:text-gold"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">Shop</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {nav.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="hover:text-gold">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/offers" className="hover:text-gold">
                Offers
              </Link>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-3">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">Customer care</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {footer.links.map((link) => (
              <li key={`${link.label}-${link.href}`}>
                <Link href={link.href} className="hover:text-gold">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-3">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">Contact</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {general.contactPhone ? (
              <li className="flex gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                <a href={`tel:${general.contactPhone.replace(/[^\d+]/g, "")}`} className="hover:text-gold">
                  {general.contactPhone}
                </a>
              </li>
            ) : null}
            {whatsappDigits ? (
              <li className="flex gap-2">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
                  WhatsApp us
                </a>
              </li>
            ) : null}
            <li className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
              <a href={`mailto:${general.contactEmail}`} className="break-all hover:text-gold">
                {general.contactEmail}
              </a>
            </li>
            {general.businessAddress ? (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                <span>{general.businessAddress}</span>
              </li>
            ) : null}
            {general.businessHours ? <li className="text-ivory/60">{general.businessHours}</li> : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-ivory/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-ivory/60 sm:flex-row sm:items-center sm:justify-between">
          <p>{footer.copyrightText}</p>
          <p>Prices in Bangladeshi Taka (৳). Cash on delivery available nationwide.</p>
        </div>
      </div>
    </footer>
  );
}
