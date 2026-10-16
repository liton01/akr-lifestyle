import type { SettingsGroup } from "@/lib/settings-schema";

export type ScalarField = {
  key: string;
  label: string;
  type: "text" | "email" | "url" | "textarea" | "number" | "image" | "boolean" | "timezone";
  hint?: string;
  rows?: number;
};
export type ListField = { key: string; label: string; type: "list"; hint?: string; max: number; itemFields: { key: string; label: string; type: "text" | "textarea" }[] };
export type SettingsField = ScalarField | ListField;

export const SETTINGS_TABS: { group: SettingsGroup; label: string; description: string; fields: SettingsField[] }[] = [
  {
    group: "general",
    label: "Store",
    description: "Name, branding and contact details shown across the site, emails and invoices.",
    fields: [
      { key: "storeName", label: "Store name", type: "text" },
      { key: "slogan", label: "Slogan", type: "text" },
      { key: "logoUrl", label: "Logo", type: "image", hint: "Transparent PNG/WebP, about 320×96 px. Leave empty to use the text logo." },
      { key: "faviconUrl", label: "Favicon", type: "image", hint: "Square image, at least 256×256 px." },
      { key: "contactEmail", label: "Contact email", type: "email" },
      { key: "contactPhone", label: "Contact phone", type: "text" },
      { key: "whatsappNumber", label: "WhatsApp number", type: "text", hint: "International format, e.g. +8801XXXXXXXXX" },
      { key: "businessAddress", label: "Business address", type: "textarea", rows: 2 },
      { key: "businessHours", label: "Business hours", type: "text" },
      { key: "timeZone", label: "Time zone", type: "timezone", hint: "Used for order dates, reports and day boundaries." },
    ],
  },
  {
    group: "homepage",
    label: "Homepage",
    description: "Hero section and section titles.",
    fields: [
      { key: "heroEyebrow", label: "Hero eyebrow", type: "text" },
      { key: "heroTitle", label: "Hero title", type: "text" },
      { key: "heroSubtitle", label: "Hero description", type: "textarea", rows: 3 },
      { key: "heroImageUrl", label: "Hero image", type: "image", hint: "Wide image, about 1800×1200 px." },
      { key: "heroPrimaryCtaLabel", label: "Primary button label", type: "text" },
      { key: "heroPrimaryCtaHref", label: "Primary button link", type: "url" },
      { key: "heroSecondaryCtaLabel", label: "Secondary button label", type: "text" },
      { key: "heroSecondaryCtaHref", label: "Secondary button link", type: "url" },
      { key: "featuredTitle", label: "Featured section title", type: "text" },
      { key: "newArrivalsTitle", label: "New arrivals title", type: "text" },
      { key: "bestSellersTitle", label: "Best sellers title", type: "text" },
      {
        key: "trustPoints",
        label: "Trust points",
        type: "list",
        max: 6,
        itemFields: [
          { key: "title", label: "Title", type: "text" },
          { key: "text", label: "Text", type: "text" },
        ],
      },
    ],
  },
  {
    group: "announcement",
    label: "Announcement bar",
    description: "The slim bar at the very top of every page.",
    fields: [
      { key: "enabled", label: "Show announcement bar", type: "boolean" },
      { key: "text", label: "Text", type: "text" },
      { key: "linkUrl", label: "Link", type: "url" },
      { key: "linkLabel", label: "Link label", type: "text" },
    ],
  },
  {
    group: "commerce",
    label: "Checkout",
    description: "Payment methods, delivery, returns and stock alert rules.",
    fields: [
      { key: "codEnabled", label: "Cash on delivery", type: "boolean" },
      { key: "onlinePaymentEnabled", label: "Online payment (requires SSLCommerz credentials on the server)", type: "boolean" },
      { key: "guestCheckoutEnabled", label: "Allow guest checkout", type: "boolean" },
      { key: "freeDeliveryEnabled", label: "Free delivery thresholds", type: "boolean", hint: "Uses each delivery zone's “free over” amount." },
      { key: "paymentTimeoutMinutes", label: "Online payment window (minutes)", type: "number", hint: "Unpaid online orders are cancelled after this and their stock released." },
      { key: "returnWindowDays", label: "Return window (days after delivery)", type: "number" },
      { key: "defaultLowStockThreshold", label: "Default low-stock threshold", type: "number" },
      { key: "maxQuantityPerLine", label: "Maximum quantity per product in one order", type: "number" },
    ],
  },
  {
    group: "content",
    label: "Pages & policies",
    description: "Formatting: blank line = paragraph, “## ” heading, “- ” bullet, **bold**.",
    fields: [
      { key: "aboutTitle", label: "About page title", type: "text" },
      { key: "aboutContent", label: "About page", type: "textarea", rows: 10 },
      { key: "contactIntro", label: "Contact page introduction", type: "textarea", rows: 3 },
      { key: "shippingPolicy", label: "Shipping policy", type: "textarea", rows: 10 },
      { key: "returnPolicy", label: "Return policy", type: "textarea", rows: 10 },
      { key: "refundPolicy", label: "Refund policy", type: "textarea", rows: 8 },
      { key: "privacyPolicy", label: "Privacy policy", type: "textarea", rows: 10 },
      { key: "terms", label: "Terms & conditions", type: "textarea", rows: 10 },
      {
        key: "faqs",
        label: "Frequently asked questions",
        type: "list",
        max: 50,
        itemFields: [
          { key: "question", label: "Question", type: "text" },
          { key: "answer", label: "Answer", type: "textarea" },
        ],
      },
    ],
  },
  {
    group: "footer",
    label: "Footer",
    description: "Footer text and customer-care links.",
    fields: [
      { key: "aboutText", label: "About text", type: "textarea", rows: 3 },
      { key: "copyrightText", label: "Copyright line", type: "text" },
      {
        key: "links",
        label: "Links",
        type: "list",
        max: 16,
        itemFields: [
          { key: "label", label: "Label", type: "text" },
          { key: "href", label: "Link", type: "text" },
        ],
      },
    ],
  },
  {
    group: "social",
    label: "Social",
    description: "Full https:// links to your profiles. Empty links are hidden.",
    fields: [
      { key: "facebook", label: "Facebook", type: "url" },
      { key: "instagram", label: "Instagram", type: "url" },
      { key: "youtube", label: "YouTube", type: "url" },
      { key: "tiktok", label: "TikTok", type: "url" },
      { key: "linkedin", label: "LinkedIn", type: "url" },
    ],
  },
  {
    group: "seo",
    label: "SEO",
    description: "Defaults for search engines and social sharing.",
    fields: [
      { key: "defaultTitle", label: "Default page title", type: "text" },
      { key: "titleTemplate", label: "Title template", type: "text", hint: "Must contain %s, e.g. “%s | AKR Lifestyle”." },
      { key: "defaultDescription", label: "Default meta description", type: "textarea", rows: 3 },
      { key: "ogImageUrl", label: "Social sharing image", type: "image", hint: "1200×630 px recommended." },
    ],
  },
];
