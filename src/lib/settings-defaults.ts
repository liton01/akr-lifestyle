import type { StoreSettings } from "@/lib/settings-schema";

/**
 * Default store settings. They are written to the database by the seed script and are
 * used as fallbacks for any missing field. Administrators edit the live values in
 * Admin → Settings; nothing here is meant to be edited in code for day-to-day changes.
 *
 * Long-form content uses a small, safe formatting subset rendered by <RichText>:
 * "## Heading", "- bullet", blank-line separated paragraphs and **bold**.
 */
export const DEFAULT_SETTINGS: StoreSettings = {
  general: {
    storeName: "AKR Lifestyle",
    slogan: "Your Style. Your Technology. Your AKR.",
    logoUrl: "",
    faviconUrl: "",
    contactEmail: "hello@akrlifestyle.com",
    contactPhone: "+880 1700-000000",
    whatsappNumber: "+8801700000000",
    businessAddress: "House 12, Road 5, Gulshan 1, Dhaka 1212, Bangladesh",
    businessHours: "Saturday – Thursday, 10:00 AM – 8:00 PM",
    currency: "BDT",
    timeZone: "Asia/Dhaka",
  },
  social: {
    facebook: "",
    instagram: "",
    youtube: "",
    tiktok: "",
    linkedin: "",
  },
  seo: {
    defaultTitle: "AKR Lifestyle — Premium Electronics, Watches & Jewellery",
    titleTemplate: "%s | AKR Lifestyle",
    defaultDescription:
      "Shop authentic electronics, smart gadgets, watches, jewellery and lifestyle accessories in Bangladesh. Cash on delivery and secure online payment.",
    ogImageUrl: "",
  },
  homepage: {
    heroEyebrow: "New season collection",
    heroTitle: "Where refined style meets everyday technology",
    heroSubtitle:
      "Curated electronics, smart gadgets, timeless watches and fine jewellery — authentic products, delivered across Bangladesh.",
    heroImageUrl: "",
    heroPrimaryCtaLabel: "Shop the collection",
    heroPrimaryCtaHref: "/shop",
    heroSecondaryCtaLabel: "View offers",
    heroSecondaryCtaHref: "/offers",
    featuredTitle: "Featured pieces",
    newArrivalsTitle: "New arrivals",
    bestSellersTitle: "Best sellers",
    trustPoints: [
      { title: "100% authentic", text: "Every product is sourced from authorised distributors." },
      { title: "Nationwide delivery", text: "Fast delivery to all 64 districts of Bangladesh." },
      { title: "Cash on delivery", text: "Pay when you receive your order, or pay securely online." },
      { title: "Easy returns", text: "Hassle-free returns within the return window." },
    ],
  },
  announcement: {
    enabled: true,
    text: "Free delivery inside Dhaka on orders over ৳5,000",
    linkUrl: "/shipping-policy",
    linkLabel: "Details",
  },
  footer: {
    aboutText:
      "AKR Lifestyle brings together premium electronics, smart gadgets, watches and jewellery for people who value quality, authenticity and design.",
    copyrightText: "© AKR Lifestyle. All rights reserved.",
    links: [
      { label: "About us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
      { label: "Track your order", href: "/track-order" },
      { label: "Shipping policy", href: "/shipping-policy" },
      { label: "Returns & refunds", href: "/return-policy" },
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Terms & conditions", href: "/terms" },
    ],
  },
  content: {
    aboutTitle: "About AKR Lifestyle",
    aboutContent: `AKR Lifestyle is a Bangladeshi lifestyle brand built on a simple idea: the technology you use and the pieces you wear should feel equally considered.

## What we offer
- Electronics and smart gadgets from trusted global brands
- Watches for every occasion, from everyday smartwatches to classic automatics
- Fine and fashion jewellery crafted with care
- Lifestyle accessories that complete your look

## Our promise
Every product we sell is **authentic** and sourced from authorised distributors or directly from manufacturers. We inspect each order before dispatch and deliver to all 64 districts of Bangladesh.

## Customer care
Our team is available to help you choose the right product, track an order or arrange a return. Reach us by phone, WhatsApp or email — we usually reply within a few hours during business hours.`,
    contactIntro:
      "Have a question about a product, an order or a return? Send us a message and our customer care team will get back to you within one business day.",
    shippingPolicy: `## Delivery areas
We deliver to all 64 districts of Bangladesh through trusted courier partners.

## Delivery charges
Delivery charges depend on your district and are shown at checkout before you place your order. Free delivery applies to eligible orders above the threshold shown at checkout.

## Delivery time
- Inside Dhaka: usually 1–2 working days
- Dhaka suburbs: usually 2–3 working days
- Outside Dhaka: usually 3–5 working days

Delivery times are estimates and may be longer during public holidays, severe weather or courier disruptions.

## Order confirmation
For cash-on-delivery orders our team may call you to confirm your order before dispatch. Please keep your phone reachable.

## Receiving your order
Please check the package in front of the delivery person. If the package is damaged or tampered with, you may refuse it and contact us immediately.`,
    returnPolicy: `## Return window
You may request a return within **7 days** of delivery for products that are unused, in their original packaging and with all accessories, tags and warranty cards.

## Eligible reasons
- The product is defective or damaged on arrival
- You received the wrong product, colour or size
- The product is significantly different from its description

## Non-returnable items
- Earrings and other pierced jewellery, for hygiene reasons
- Products with broken seals where the seal is part of the packaging (e.g. earbuds)
- Products damaged through misuse

## How to request a return
Sign in to your account, open the order and choose **Request a return**, or contact customer care with your order number. Once the return is approved, we will arrange pickup or share the drop-off address.`,
    refundPolicy: `## When refunds are issued
Refunds are issued after we receive and inspect the returned product, or after an eligible paid order is cancelled.

## Refund methods
- Online payments are refunded to the original payment method where possible
- Cash-on-delivery orders are refunded by bKash, Nagad or bank transfer

## Timeline
Refunds are processed within 3–7 working days after approval. Bank and card refunds may take additional time depending on your bank.

## Delivery charges
Delivery charges are refunded only when the return is due to our error (defective, damaged or wrong product).`,
    privacyPolicy: `## Information we collect
We collect the information you provide when you create an account, place an order or contact us: your name, phone number, email address and delivery address. We also record your order history.

## How we use your information
- To process and deliver your orders
- To contact you about your orders and returns
- To provide customer support
- To prevent fraud and keep the store secure

## Payments
Online payments are processed by our payment partner. We never see or store your full card or mobile-wallet credentials.

## Sharing
We share your delivery details only with courier partners for the purpose of delivering your order. We do not sell your personal information.

## Your choices
You can update your profile and addresses from your account at any time, or contact us to request deletion of your account.`,
    terms: `## Using this website
By using this website and placing orders you agree to these terms. Please read them carefully.

## Products and prices
All prices are in Bangladeshi Taka (BDT) and include applicable taxes unless stated otherwise. We make every effort to display products and prices accurately; if an error is found we will contact you before processing your order.

## Orders
An order is accepted when we confirm it. We may cancel an order if a product is unavailable, if pricing information was incorrect, or if we suspect fraud. Any payment received for a cancelled order will be refunded.

## Promotions and coupons
Only one coupon can be used per order. Promotions cannot be combined unless stated. Coupons have no cash value.

## Warranty
Manufacturer warranties apply where stated on the product page. Warranty claims are handled according to the manufacturer's terms.

## Contact
Questions about these terms can be sent to our customer care team.`,
    faqs: [
      {
        question: "Are your products authentic?",
        answer: "Yes. Every product is sourced from authorised distributors or directly from the manufacturer, and is covered by the warranty stated on its product page.",
      },
      {
        question: "Which payment methods do you accept?",
        answer: "Cash on delivery across Bangladesh, and secure online payment (cards, mobile banking and internet banking) where available at checkout.",
      },
      {
        question: "How long does delivery take?",
        answer: "Usually 1–2 working days inside Dhaka and 3–5 working days for other districts. You will see the delivery charge for your district at checkout.",
      },
      {
        question: "How do I track my order?",
        answer: "Use the Track Order page with your order number and phone number, or sign in to your account to see all your orders.",
      },
      {
        question: "Can I cancel my order?",
        answer: "You can cancel from your account while the order is pending or confirmed. Once it is being processed, please contact customer care.",
      },
      {
        question: "What is your return policy?",
        answer: "Eligible products can be returned within the return window after delivery. See the Returns & Refunds page for details.",
      },
    ],
  },
  commerce: {
    codEnabled: true,
    onlinePaymentEnabled: true,
    guestCheckoutEnabled: true,
    freeDeliveryEnabled: true,
    paymentTimeoutMinutes: 45,
    returnWindowDays: 7,
    defaultLowStockThreshold: 5,
    maxQuantityPerLine: 10,
  },
};
