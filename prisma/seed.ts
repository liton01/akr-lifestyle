/**
 * Repeatable development seed. Safe to run multiple times: existing records (matched by
 * slug / SKU / code / key) are left untouched, so admin edits are never overwritten.
 *
 *   npm run db:seed
 *
 * Seed products use fictional sample brands and generated artwork — replace them with
 * your real catalogue in Admin → Products.
 */
import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import sharp from "sharp";
import { DEFAULT_SETTINGS } from "../src/lib/settings-defaults";
import { SETTINGS_GROUPS } from "../src/lib/settings-schema";
import { adminPasswordProblem, bootstrapAdmin } from "../src/server/services/bootstrap";
import { getStorage } from "../src/server/storage";
import { storageKey, type UploadFolder } from "../src/server/storage/images";
import { bannerArt, productArt, type ArtKind } from "./seed-art";

const db = new PrismaClient();
const DAY = 86_400_000;

async function upload(svg: string, folder: UploadFolder, width: number, height: number) {
  const buffer = await sharp(Buffer.from(svg)).resize(width, height).webp({ quality: 86 }).toBuffer();
  const stored = await getStorage().put(storageKey(folder), buffer, "image/webp");
  return { url: stored.url, key: stored.key, width, height };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference data
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES: { name: string; slug: string; description: string; art: ArtKind; children: { name: string; slug: string; art: ArtKind }[] }[] = [
  {
    name: "Electronics",
    slug: "electronics",
    description: "Premium audio, smart home and computer accessories.",
    art: "headphones",
    children: [
      { name: "Audio", slug: "audio", art: "headphones" },
      { name: "Smart Home", slug: "smart-home", art: "bulb" },
      { name: "Computer Accessories", slug: "computer-accessories", art: "keyboard" },
    ],
  },
  {
    name: "Gadgets",
    slug: "gadgets",
    description: "Everyday tech that keeps you powered and connected.",
    art: "powerbank",
    children: [
      { name: "Power & Charging", slug: "power-charging", art: "charger" },
      { name: "Mobile Accessories", slug: "mobile-accessories", art: "stand" },
      { name: "Smart Gadgets", slug: "smart-gadgets", art: "camera" },
    ],
  },
  {
    name: "Watches",
    slug: "watches",
    description: "Timeless automatics, elegant dress watches and smartwatches.",
    art: "watch",
    children: [
      { name: "Smartwatches", slug: "smartwatches", art: "smartwatch" },
      { name: "Men's Watches", slug: "mens-watches", art: "watch" },
      { name: "Women's Watches", slug: "womens-watches", art: "watch-slim" },
    ],
  },
  {
    name: "Jewellery",
    slug: "jewellery",
    description: "Fine and fashion jewellery crafted to be treasured.",
    art: "ring",
    children: [
      { name: "Rings", slug: "rings", art: "ring" },
      { name: "Necklaces", slug: "necklaces", art: "necklace" },
      { name: "Earrings", slug: "earrings", art: "earrings" },
      { name: "Bracelets", slug: "bracelets", art: "bracelet" },
    ],
  },
  {
    name: "Lifestyle Accessories",
    slug: "lifestyle-accessories",
    description: "Leather goods, eyewear and finishing touches.",
    art: "wallet",
    children: [
      { name: "Bags & Wallets", slug: "bags-wallets", art: "wallet" },
      { name: "Sunglasses", slug: "sunglasses", art: "sunglasses" },
      { name: "Belts", slug: "belts", art: "belt" },
    ],
  },
];

const BRANDS = [
  { name: "AKR Signature", slug: "akr-signature", description: "AKR Lifestyle's own collection." },
  { name: "Nordvik Audio", slug: "nordvik-audio", description: "Scandinavian-inspired sound. (Sample brand)" },
  { name: "Voltix", slug: "voltix", description: "Fast, safe charging gear. (Sample brand)" },
  { name: "Lumen Home", slug: "lumen-home", description: "Simple smart-home essentials. (Sample brand)" },
  { name: "Chronos & Co.", slug: "chronos-co", description: "Classic watchmaking. (Sample brand)" },
  { name: "Aurelle", slug: "aurelle", description: "Fine jewellery. (Sample brand)" },
];

const ATTRIBUTES = [
  {
    name: "Color",
    displayType: "COLOR" as const,
    values: [
      { value: "Midnight Black", colorHex: "#1F1F1F" },
      { value: "Ivory White", colorHex: "#F3EFE6" },
      { value: "Silver", colorHex: "#C4C4C4" },
      { value: "Rose Gold", colorHex: "#B76E79" },
      { value: "Cognac Brown", colorHex: "#7B4A2A" },
      { value: "Ocean Blue", colorHex: "#2C4A6E" },
    ],
  },
  { name: "Case Size", displayType: "TEXT" as const, values: [{ value: "41mm" }, { value: "45mm" }] },
  { name: "Ring Size", displayType: "TEXT" as const, values: [{ value: "6" }, { value: "7" }, { value: "8" }] },
  { name: "Dial", displayType: "TEXT" as const, values: [{ value: "Black Dial" }, { value: "Ivory Dial" }] },
];

type SeedVariant = { sku: string; options: Record<string, string>; stock: number; price?: number; art?: { body?: string; accent?: string } };
type SeedProduct = {
  name: string;
  slug: string;
  sku: string;
  category: string;
  brand: string;
  productType: string;
  price: number;
  compareAtPrice?: number;
  costPrice: number;
  sale?: { price: number; startsInDays: number; endsInDays: number };
  stock?: number;
  lowStockThreshold?: number;
  flags?: { featured?: boolean; newArrival?: boolean; bestSeller?: boolean };
  short: string;
  description: string;
  specs: [string, string][];
  art: ArtKind;
  artOptions?: { body?: string; accent?: string; dark?: boolean };
  variants?: SeedVariant[];
  soldCount?: number;
  weightGrams?: number;
};

const C = { black: "#1F1F1F", white: "#ECE6DA", silver: "#BDBDBD", rose: "#B76E79", brown: "#7B4A2A", blue: "#2C4A6E" };

const PRODUCTS: SeedProduct[] = [
  {
    name: "Nordvik Aura ANC Wireless Headphones",
    slug: "nordvik-aura-anc-wireless-headphones",
    sku: "NV-AURA-ANC",
    category: "audio",
    brand: "nordvik-audio",
    productType: "Headphones",
    price: 12500,
    compareAtPrice: 14990,
    costPrice: 8900,
    flags: { featured: true, bestSeller: true },
    short: "Hybrid active noise cancellation, 40-hour battery and plush memory-foam cushions.",
    description:
      "Escape into your music with Aura. Hybrid active noise cancellation adapts to your surroundings, while 40mm custom drivers deliver rich, balanced sound.\n\nUp to 40 hours of playback, fast charging (10 minutes for 5 hours) and multipoint Bluetooth 5.3 keep you connected all day. The fold-flat design and premium carrying case make Aura the perfect travel companion.",
    specs: [
      ["Bluetooth", "5.3, multipoint"],
      ["Battery", "Up to 40 hours (ANC off)"],
      ["Charging", "USB-C, fast charge"],
      ["Drivers", "40 mm dynamic"],
      ["Warranty", "1 year"],
    ],
    art: "headphones",
    variants: [
      { sku: "NV-AURA-ANC-BLK", options: { Color: "Midnight Black" }, stock: 18, art: { body: C.black } },
      { sku: "NV-AURA-ANC-WHT", options: { Color: "Ivory White" }, stock: 9, art: { body: C.white } },
    ],
    soldCount: 64,
    weightGrams: 250,
  },
  {
    name: "Nordvik Pods Pro True Wireless Earbuds",
    slug: "nordvik-pods-pro-earbuds",
    sku: "NV-PODS-PRO",
    category: "audio",
    brand: "nordvik-audio",
    productType: "Earbuds",
    price: 6990,
    costPrice: 4300,
    sale: { price: 5990, startsInDays: -2, endsInDays: 14 },
    flags: { newArrival: true },
    short: "Compact earbuds with ANC, transparency mode and wireless charging case.",
    description:
      "Pods Pro deliver immersive sound in a pocketable design. Switch between noise cancellation and transparency with a tap, and enjoy up to 30 hours of listening with the wireless charging case.\n\nIPX4 sweat resistance makes them ready for workouts and Dhaka monsoon commutes alike.",
    specs: [
      ["Battery", "7 h earbuds, 30 h with case"],
      ["Water resistance", "IPX4"],
      ["Charging", "USB-C and Qi wireless"],
      ["Warranty", "1 year"],
    ],
    art: "earbuds",
    variants: [
      { sku: "NV-PODS-PRO-BLK", options: { Color: "Midnight Black" }, stock: 25, art: { body: C.black } },
      { sku: "NV-PODS-PRO-WHT", options: { Color: "Ivory White" }, stock: 14, art: { body: C.white } },
    ],
    soldCount: 41,
    weightGrams: 60,
  },
  {
    name: "Nordvik Pulse Portable Speaker",
    slug: "nordvik-pulse-portable-speaker",
    sku: "NV-PULSE",
    category: "audio",
    brand: "nordvik-audio",
    productType: "Speaker",
    price: 4500,
    costPrice: 2900,
    stock: 3,
    short: "360° sound, IP67 waterproof and 20 hours of play.",
    description: "Pulse fills any room — or rooftop — with 360° sound. It's dustproof and waterproof (IP67), floats, and plays for up to 20 hours on a charge.",
    specs: [
      ["Output", "20 W"],
      ["Battery", "20 hours"],
      ["Protection", "IP67"],
    ],
    art: "speaker",
    artOptions: { body: C.blue },
    soldCount: 22,
    weightGrams: 540,
  },
  {
    name: "Lumen Smart Wi-Fi Bulb (2-Pack)",
    slug: "lumen-smart-wifi-bulb-2-pack",
    sku: "LM-BULB-2PK",
    category: "smart-home",
    brand: "lumen-home",
    productType: "Smart lighting",
    price: 1850,
    costPrice: 1100,
    stock: 40,
    short: "16 million colours, schedules and voice control — no hub required.",
    description: "Set the mood with millions of colours and tunable white light. Control from your phone, set schedules, or use your voice assistant. E27 base, 9 W (60 W equivalent).",
    specs: [
      ["Base", "E27"],
      ["Power", "9 W"],
      ["Connectivity", "2.4 GHz Wi-Fi"],
    ],
    art: "bulb",
    soldCount: 30,
  },
  {
    name: "Lumen Smart Plug Mini",
    slug: "lumen-smart-plug-mini",
    sku: "LM-PLUG-MINI",
    category: "smart-home",
    brand: "lumen-home",
    productType: "Smart plug",
    price: 1290,
    costPrice: 760,
    stock: 0,
    short: "Make any appliance smart with schedules and energy monitoring.",
    description: "Turn appliances on or off from anywhere, create schedules and monitor energy use. Compact design that doesn't block the second socket.",
    specs: [
      ["Max load", "16 A"],
      ["Connectivity", "2.4 GHz Wi-Fi"],
    ],
    art: "plug",
    soldCount: 12,
  },
  {
    name: "AKR Signature Wireless Keyboard & Mouse Set",
    slug: "akr-wireless-keyboard-mouse-set",
    sku: "AKR-KBM-01",
    category: "computer-accessories",
    brand: "akr-signature",
    productType: "Keyboard & mouse",
    price: 3200,
    costPrice: 1950,
    stock: 22,
    short: "Quiet low-profile keys and a precision mouse with a single USB receiver.",
    description: "A clean desk setup starts here. Whisper-quiet scissor keys, a comfortable silent-click mouse and up to 12 months of battery life.",
    specs: [
      ["Connection", "2.4 GHz USB receiver"],
      ["Battery", "Up to 12 months"],
    ],
    art: "keyboard",
    soldCount: 9,
  },
  {
    name: "Voltix 20,000mAh Fast-Charge Power Bank",
    slug: "voltix-20000mah-power-bank",
    sku: "VX-PB-20K",
    category: "power-charging",
    brand: "voltix",
    productType: "Power bank",
    price: 3490,
    costPrice: 2200,
    stock: 35,
    flags: { bestSeller: true },
    short: "Charge three devices at once with 22.5 W fast charging.",
    description: "Enough power to charge a phone four times. USB-C PD in/out plus two USB-A ports, with a clear LED charge indicator and multi-layer safety protection.",
    specs: [
      ["Capacity", "20,000 mAh"],
      ["Output", "22.5 W max"],
      ["Ports", "1× USB-C, 2× USB-A"],
    ],
    art: "powerbank",
    soldCount: 88,
    weightGrams: 380,
  },
  {
    name: "Voltix 65W GaN USB-C Charger",
    slug: "voltix-65w-gan-charger",
    sku: "VX-GAN-65",
    category: "power-charging",
    brand: "voltix",
    productType: "Charger",
    price: 2950,
    compareAtPrice: 3500,
    costPrice: 1800,
    stock: 27,
    short: "Laptop-class power in a pocket-size charger.",
    description: "Charge your laptop, tablet and phone from one compact GaN charger. Two USB-C ports and one USB-A with intelligent power distribution.",
    specs: [
      ["Output", "65 W max"],
      ["Ports", "2× USB-C, 1× USB-A"],
      ["Plug", "Type G/C adapters included"],
    ],
    art: "charger",
    artOptions: { body: "#EDE7DC", accent: "#A88A50" },
    soldCount: 37,
  },
  {
    name: "Voltix Braided USB-C Cable (2 m)",
    slug: "voltix-braided-usb-c-cable-2m",
    sku: "VX-CBL-C2M",
    category: "mobile-accessories",
    brand: "voltix",
    productType: "Cable",
    price: 690,
    costPrice: 320,
    stock: 120,
    short: "Durable braided cable rated for 100 W charging.",
    description: "A tough, tangle-free braided cable that supports up to 100 W charging and 480 Mbps data transfer.",
    specs: [
      ["Length", "2 m"],
      ["Rating", "100 W"],
    ],
    art: "cable",
    soldCount: 140,
  },
  {
    name: "AKR Magnetic Phone Stand",
    slug: "akr-magnetic-phone-stand",
    sku: "AKR-STAND-01",
    category: "mobile-accessories",
    brand: "akr-signature",
    productType: "Phone stand",
    price: 1450,
    costPrice: 800,
    stock: 16,
    flags: { newArrival: true },
    short: "Weighted aluminium stand with an adjustable magnetic mount.",
    description: "Hold your phone at the perfect angle for video calls and recipes. Anodised aluminium with a non-slip base.",
    specs: [["Material", "Aluminium alloy"]],
    art: "stand",
    soldCount: 5,
  },
  {
    name: "Voltix Action Camera 4K",
    slug: "voltix-action-camera-4k",
    sku: "VX-CAM-4K",
    category: "smart-gadgets",
    brand: "voltix",
    productType: "Action camera",
    price: 9900,
    costPrice: 6800,
    stock: 7,
    flags: { newArrival: true, featured: true },
    short: "4K60 video, image stabilisation and a waterproof case.",
    description: "Capture adventures in crisp 4K at 60 fps with electronic image stabilisation. Includes a 30 m waterproof case and mounting kit.",
    specs: [
      ["Video", "4K 60 fps"],
      ["Waterproof", "30 m with case"],
      ["Battery", "2× 1350 mAh"],
    ],
    art: "camera",
    soldCount: 6,
  },
  {
    name: "Chronos & Co. Meridian Automatic Watch",
    slug: "chronos-meridian-automatic",
    sku: "CH-MERIDIAN",
    category: "mens-watches",
    brand: "chronos-co",
    productType: "Automatic watch",
    price: 28500,
    costPrice: 19500,
    flags: { featured: true },
    short: "Self-winding movement, sapphire crystal and a 42-hour power reserve.",
    description:
      "Meridian pairs a reliable automatic movement with a refined 40 mm stainless-steel case and sapphire crystal. The exhibition case back reveals the movement at work.\n\nWater resistant to 100 m and finished with a hand-stitched leather strap.",
    specs: [
      ["Movement", "Automatic, 42 h reserve"],
      ["Case", "40 mm stainless steel"],
      ["Crystal", "Sapphire"],
      ["Water resistance", "100 m"],
      ["Warranty", "2 years"],
    ],
    art: "watch",
    variants: [
      { sku: "CH-MERIDIAN-BLK", options: { Dial: "Black Dial" }, stock: 4, art: { body: C.brown, accent: "#1A1A1A" } },
      { sku: "CH-MERIDIAN-IVR", options: { Dial: "Ivory Dial" }, stock: 2, art: { body: C.brown, accent: "#F3EEE2" } },
    ],
    soldCount: 14,
    weightGrams: 110,
  },
  {
    name: "Chronos & Co. Luna Women's Watch",
    slug: "chronos-luna-womens-watch",
    sku: "CH-LUNA",
    category: "womens-watches",
    brand: "chronos-co",
    productType: "Quartz watch",
    price: 15900,
    costPrice: 10200,
    short: "A slim 32 mm case with a mother-of-pearl dial.",
    description: "Luna is understated elegance for every day. A slim case, mother-of-pearl dial and a comfortable mesh bracelet.",
    specs: [
      ["Movement", "Swiss quartz"],
      ["Case", "32 mm"],
      ["Water resistance", "50 m"],
    ],
    art: "watch-slim",
    variants: [
      { sku: "CH-LUNA-RG", options: { Color: "Rose Gold" }, stock: 6, art: { body: C.rose, accent: "#F7F0EA" } },
      { sku: "CH-LUNA-SL", options: { Color: "Silver" }, stock: 5, art: { body: C.silver, accent: "#F7F0EA" } },
    ],
    soldCount: 19,
  },
  {
    name: "AKR Fit Pro Smartwatch",
    slug: "akr-fit-pro-smartwatch",
    sku: "AKR-FITPRO",
    category: "smartwatches",
    brand: "akr-signature",
    productType: "Smartwatch",
    price: 8990,
    costPrice: 5600,
    flags: { newArrival: true, bestSeller: true },
    short: "AMOLED display, GPS, heart-rate and SpO₂ tracking with 10-day battery.",
    description:
      "Fit Pro keeps you on top of your health and your day. A bright AMOLED display, built-in GPS, 100+ workout modes, and heart-rate, sleep and SpO₂ tracking.\n\nGet calls and notifications on your wrist and enjoy up to 10 days of battery life.",
    specs: [
      ["Display", "AMOLED, always-on"],
      ["Battery", "Up to 10 days"],
      ["Sensors", "Heart rate, SpO₂, GPS"],
      ["Water resistance", "5 ATM"],
    ],
    art: "smartwatch",
    variants: [
      { sku: "AKR-FITPRO-41-BLK", options: { "Case Size": "41mm", Color: "Midnight Black" }, stock: 12, art: { body: C.black } },
      { sku: "AKR-FITPRO-41-SLV", options: { "Case Size": "41mm", Color: "Silver" }, stock: 8, art: { body: C.silver } },
      { sku: "AKR-FITPRO-45-BLK", options: { "Case Size": "45mm", Color: "Midnight Black" }, stock: 10, price: 9490, art: { body: C.black } },
      { sku: "AKR-FITPRO-45-SLV", options: { "Case Size": "45mm", Color: "Silver" }, stock: 0, price: 9490, art: { body: C.silver } },
    ],
    soldCount: 72,
  },
  {
    name: "AKR Fit Lite Smartwatch",
    slug: "akr-fit-lite-smartwatch",
    sku: "AKR-FITLITE",
    category: "smartwatches",
    brand: "akr-signature",
    productType: "Smartwatch",
    price: 4990,
    costPrice: 3000,
    stock: 30,
    short: "Lightweight fitness tracking with a 14-day battery.",
    description: "Everything you need, nothing you don't. Step, sleep and heart-rate tracking, notifications and a 14-day battery in a featherweight design.",
    specs: [
      ["Battery", "Up to 14 days"],
      ["Water resistance", "5 ATM"],
    ],
    art: "smartwatch",
    artOptions: { body: C.blue },
    soldCount: 51,
  },
  {
    name: "Aurelle Solitaire Ring",
    slug: "aurelle-solitaire-ring",
    sku: "AU-RING-SOL",
    category: "rings",
    brand: "aurelle",
    productType: "Ring",
    price: 18500,
    costPrice: 11800,
    flags: { featured: true },
    short: "A brilliant-cut stone set in 18K gold-plated sterling silver.",
    description: "A timeless solitaire for moments that matter. Hand-set brilliant-cut cubic zirconia in an 18K gold-plated 925 sterling silver band. Presented in an AKR gift box.",
    specs: [
      ["Metal", "925 sterling silver, 18K gold plated"],
      ["Stone", "Brilliant-cut cubic zirconia"],
    ],
    art: "ring",
    artOptions: { accent: "#F2F5F7" },
    variants: [
      { sku: "AU-RING-SOL-6", options: { "Ring Size": "6" }, stock: 3 },
      { sku: "AU-RING-SOL-7", options: { "Ring Size": "7" }, stock: 5 },
      { sku: "AU-RING-SOL-8", options: { "Ring Size": "8" }, stock: 2 },
    ],
    soldCount: 23,
  },
  {
    name: "Aurelle Pearl Drop Necklace",
    slug: "aurelle-pearl-drop-necklace",
    sku: "AU-NCK-PEARL",
    category: "necklaces",
    brand: "aurelle",
    productType: "Necklace",
    price: 12900,
    costPrice: 7900,
    stock: 8,
    short: "A freshwater pearl on a fine 18K gold-plated chain.",
    description: "An elegant freshwater pearl suspended from a delicate adjustable chain (40–45 cm).",
    specs: [
      ["Pearl", "Freshwater, 9 mm"],
      ["Chain", "40–45 cm adjustable"],
    ],
    art: "necklace",
    artOptions: { accent: "#F4EFE6" },
    soldCount: 11,
  },
  {
    name: "Aurelle Classic Gold Hoop Earrings",
    slug: "aurelle-classic-gold-hoops",
    sku: "AU-EAR-HOOP",
    category: "earrings",
    brand: "aurelle",
    productType: "Earrings",
    price: 6500,
    costPrice: 3900,
    stock: 15,
    flags: { bestSeller: true },
    short: "Lightweight polished hoops for everyday elegance.",
    description: "Polished 25 mm hoops in 18K gold-plated sterling silver with secure click-top closures.",
    specs: [["Diameter", "25 mm"]],
    art: "earrings",
    soldCount: 46,
  },
  {
    name: "Aurelle Tennis Bracelet",
    slug: "aurelle-tennis-bracelet",
    sku: "AU-BRC-TENNIS",
    category: "bracelets",
    brand: "aurelle",
    productType: "Bracelet",
    price: 22000,
    compareAtPrice: 25000,
    costPrice: 14500,
    stock: 4,
    short: "A continuous line of brilliant stones with a secure box clasp.",
    description: "Sparkle from every angle. Forty brilliant-cut stones in a flexible setting, finished with a double-locking box clasp.",
    specs: [
      ["Length", "18 cm"],
      ["Clasp", "Box clasp with safety lock"],
    ],
    art: "bracelet",
    artOptions: { accent: "#EEF2F5" },
    soldCount: 8,
  },
  {
    name: "AKR Signature Leather Wallet",
    slug: "akr-signature-leather-wallet",
    sku: "AKR-WAL-01",
    category: "bags-wallets",
    brand: "akr-signature",
    productType: "Wallet",
    price: 2450,
    costPrice: 1300,
    short: "Full-grain leather bifold with RFID protection.",
    description: "Crafted from full-grain leather that ages beautifully. Eight card slots, two note compartments and RFID-blocking lining.",
    specs: [
      ["Material", "Full-grain leather"],
      ["Card slots", "8"],
    ],
    art: "wallet",
    variants: [
      { sku: "AKR-WAL-01-BRN", options: { Color: "Cognac Brown" }, stock: 20, art: { body: C.brown } },
      { sku: "AKR-WAL-01-BLK", options: { Color: "Midnight Black" }, stock: 15, art: { body: C.black } },
    ],
    soldCount: 33,
  },
  {
    name: "AKR Weekend Tote",
    slug: "akr-weekend-tote",
    sku: "AKR-TOTE-01",
    category: "bags-wallets",
    brand: "akr-signature",
    productType: "Bag",
    price: 4800,
    costPrice: 2700,
    stock: 10,
    short: "A structured canvas-and-leather tote with a padded laptop sleeve.",
    description: "From office to weekend. Water-resistant canvas, leather trims, a padded 14\" laptop sleeve and a zipped inner pocket.",
    specs: [["Fits", "Up to 14\" laptop"]],
    art: "bag",
    artOptions: { body: "#C9B79C" },
    soldCount: 7,
  },
  {
    name: "AKR Polarized Aviator Sunglasses",
    slug: "akr-polarized-aviator-sunglasses",
    sku: "AKR-SUN-AV",
    category: "sunglasses",
    brand: "akr-signature",
    productType: "Sunglasses",
    price: 3950,
    costPrice: 2100,
    stock: 18,
    short: "Polarized UV400 lenses in a lightweight metal frame.",
    description: "Classic aviators with polarized UV400 lenses that cut glare — ideal for bright Bangladeshi summers. Includes a hard case and cleaning cloth.",
    specs: [
      ["Lens", "Polarized, UV400"],
      ["Frame", "Metal alloy"],
    ],
    art: "sunglasses",
    soldCount: 15,
  },
  {
    name: "AKR Reversible Leather Belt",
    slug: "akr-reversible-leather-belt",
    sku: "AKR-BELT-01",
    category: "belts",
    brand: "akr-signature",
    productType: "Belt",
    price: 2200,
    costPrice: 1150,
    stock: 25,
    short: "Black and brown in one belt, with a brushed gold buckle.",
    description: "Two looks in one. Rotate the buckle to switch between black and brown leather. Cut-to-fit up to 44\".",
    specs: [["Width", "35 mm"]],
    art: "belt",
    artOptions: { body: C.brown },
    soldCount: 10,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed steps
// ─────────────────────────────────────────────────────────────────────────────

async function seedSettings(heroImageUrl: string | null) {
  for (const group of SETTINGS_GROUPS) {
    const value = structuredClone(DEFAULT_SETTINGS[group]) as Record<string, unknown>;
    if (group === "homepage" && heroImageUrl) value.heroImageUrl = heroImageUrl;
    await db.setting.upsert({ where: { key: group }, create: { key: group, value: value as Prisma.InputJsonValue }, update: {} });
  }
}

async function seedDeliveryZones() {
  const zones = [
    { name: "Inside Dhaka", districts: ["Dhaka"], fee: "70.00", freeDeliveryThreshold: "5000.00", estimatedDays: "1–2 working days", isDefault: false, sortOrder: 1 },
    {
      name: "Dhaka Suburbs",
      districts: ["Gazipur", "Narayanganj", "Munshiganj", "Manikganj", "Narsingdi"],
      fee: "110.00",
      freeDeliveryThreshold: "7000.00",
      estimatedDays: "2–3 working days",
      isDefault: false,
      sortOrder: 2,
    },
    { name: "Outside Dhaka", districts: [], fee: "130.00", freeDeliveryThreshold: "10000.00", estimatedDays: "3–5 working days", isDefault: true, sortOrder: 3 },
  ];
  for (const zone of zones) {
    await db.deliveryZone.upsert({ where: { name: zone.name }, create: zone, update: {} });
  }
}

async function seedCatalogTaxonomy() {
  const categoryIds = new Map<string, string>();
  for (const [index, root] of CATEGORIES.entries()) {
    let parent = await db.category.findUnique({ where: { slug: root.slug } });
    if (!parent) {
      const image = await upload(productArt(root.art, { dark: true }), "categories", 900, 900);
      parent = await db.category.create({
        data: { name: root.name, slug: root.slug, description: root.description, imageUrl: image.url, sortOrder: index * 10, isActive: true },
      });
    }
    categoryIds.set(root.slug, parent.id);
    for (const [childIndex, child] of root.children.entries()) {
      let existing = await db.category.findUnique({ where: { slug: child.slug } });
      if (!existing) {
        const image = await upload(productArt(child.art), "categories", 900, 900);
        existing = await db.category.create({
          data: { name: child.name, slug: child.slug, parentId: parent.id, imageUrl: image.url, sortOrder: childIndex * 10, isActive: true },
        });
      }
      categoryIds.set(child.slug, existing.id);
    }
  }

  const brandIds = new Map<string, string>();
  for (const [index, brand] of BRANDS.entries()) {
    const saved = await db.brand.upsert({ where: { slug: brand.slug }, create: { ...brand, sortOrder: index * 10 }, update: {} });
    brandIds.set(brand.slug, saved.id);
  }

  const attributeValueIds = new Map<string, { attributeId: string; valueId: string }>();
  for (const [index, attribute] of ATTRIBUTES.entries()) {
    const slug = attribute.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const saved = await db.attribute.upsert({
      where: { slug },
      create: { name: attribute.name, slug, displayType: attribute.displayType, sortOrder: index * 10 },
      update: {},
    });
    for (const [valueIndex, value] of attribute.values.entries()) {
      const savedValue = await db.attributeValue.upsert({
        where: { attributeId_value: { attributeId: saved.id, value: value.value } },
        create: { attributeId: saved.id, value: value.value, colorHex: (value as { colorHex?: string }).colorHex ?? null, sortOrder: valueIndex * 10 },
        update: {},
      });
      attributeValueIds.set(`${attribute.name}:${value.value}`, { attributeId: saved.id, valueId: savedValue.id });
    }
  }
  return { categoryIds, brandIds, attributeValueIds };
}

async function seedProducts(refs: Awaited<ReturnType<typeof seedCatalogTaxonomy>>, adminId: string | null) {
  const now = Date.now();
  let created = 0;
  for (const p of PRODUCTS) {
    const exists = await db.product.findUnique({ where: { sku: p.sku }, select: { id: true } });
    if (exists) continue;
    const categoryId = refs.categoryIds.get(p.category);
    const brandId = refs.brandIds.get(p.brand);
    if (!categoryId || !brandId) throw new Error(`Missing category/brand for ${p.sku}`);

    const images = [];
    const primary = await upload(productArt(p.art, p.artOptions), "products", 1200, 1200);
    images.push(primary);
    const alternate = await upload(productArt(p.art, { ...p.artOptions, dark: !p.artOptions?.dark, angle: -8 }), "products", 1200, 1200);
    images.push(alternate);

    const product = await db.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        shortDescription: p.short,
        description: p.description,
        categoryId,
        brandId,
        productType: p.productType,
        price: p.price.toFixed(2),
        compareAtPrice: p.compareAtPrice?.toFixed(2) ?? null,
        costPrice: p.costPrice.toFixed(2),
        salePrice: p.sale?.price.toFixed(2) ?? null,
        saleStartsAt: p.sale ? new Date(now + p.sale.startsInDays * DAY) : null,
        saleEndsAt: p.sale ? new Date(now + p.sale.endsInDays * DAY) : null,
        lowStockThreshold: p.lowStockThreshold ?? 5,
        weightGrams: p.weightGrams ?? null,
        status: "ACTIVE",
        isFeatured: p.flags?.featured ?? false,
        isNewArrival: p.flags?.newArrival ?? false,
        isBestSeller: p.flags?.bestSeller ?? false,
        specifications: p.specs.map(([label, value]) => ({ label, value })),
        soldCount: p.soldCount ?? 0,
        publishedAt: new Date(now - Math.floor(Math.random() * 60) * DAY),
        images: {
          create: images.map((image, index) => ({
            url: image.url,
            storageKey: image.key,
            alt: index === 0 ? p.name : `${p.name} — alternate view`,
            width: image.width,
            height: image.height,
            sortOrder: index,
          })),
        },
      },
    });

    const variants: SeedVariant[] = p.variants ?? [{ sku: p.sku, options: {}, stock: p.stock ?? 0 }];
    for (const [index, v] of variants.entries()) {
      const isDefault = !p.variants;
      let imageUrl: string | null = null;
      if (v.art) imageUrl = (await upload(productArt(p.art, { ...p.artOptions, ...v.art }), "products", 1200, 1200)).url;
      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          sku: v.sku,
          name: isDefault ? "Default" : Object.values(v.options).join(" / "),
          isDefault,
          sortOrder: index,
          price: v.price?.toFixed(2) ?? null,
          imageUrl,
          options: {
            create: Object.entries(v.options).map(([attribute, value]) => {
              const ref = refs.attributeValueIds.get(`${attribute}:${value}`);
              if (!ref) throw new Error(`Unknown option ${attribute}:${value}`);
              return { attributeId: ref.attributeId, attributeValueId: ref.valueId };
            }),
          },
          inventory: { create: { quantity: v.stock } },
        },
      });
      if (v.stock > 0) {
        await db.inventoryMovement.create({
          data: {
            variantId: variant.id,
            sku: variant.sku,
            productName: product.name,
            type: "INITIAL_STOCK",
            quantityChange: v.stock,
            quantityBefore: 0,
            quantityAfter: v.stock,
            reason: "Seed data",
            actorId: adminId,
            dedupeKey: `variant:${variant.id}:initial`,
          },
        });
      }
    }
    created += 1;
  }
  return created;
}

async function seedPromotions(refs: Awaited<ReturnType<typeof seedCatalogTaxonomy>>) {
  const now = Date.now();
  const jewellery = refs.categoryIds.get("jewellery")!;
  const voltix = refs.brandIds.get("voltix")!;

  if (!(await db.discount.findFirst({ where: { name: "Jewellery Festive Edit" } }))) {
    await db.discount.create({
      data: {
        name: "Jewellery Festive Edit",
        description: "10% off all jewellery for the festive season.",
        type: "PERCENTAGE",
        value: "10.00",
        scope: "CATEGORY",
        badgeLabel: "Festive -10%",
        startsAt: new Date(now - DAY),
        endsAt: new Date(now + 30 * DAY),
        categories: { connect: [{ id: jewellery }] },
      },
    });
  }
  if (!(await db.discount.findFirst({ where: { name: "Voltix Charging Week" } }))) {
    await db.discount.create({
      data: {
        name: "Voltix Charging Week",
        type: "FIXED_AMOUNT",
        value: "300.00",
        scope: "BRAND",
        badgeLabel: "৳300 off",
        startsAt: new Date(now - DAY),
        endsAt: new Date(now + 10 * DAY),
        brands: { connect: [{ id: voltix }] },
      },
    });
  }
  if (!(await db.discount.findFirst({ where: { name: "11.11 Mega Sale" } }))) {
    await db.discount.create({
      data: {
        name: "11.11 Mega Sale",
        description: "Scheduled store-wide promotion (starts in the future).",
        type: "PERCENTAGE",
        value: "15.00",
        scope: "STORE_WIDE",
        maxDiscountAmount: "3000.00",
        badgeLabel: "11.11 -15%",
        startsAt: new Date(now + 25 * DAY),
        endsAt: new Date(now + 27 * DAY),
      },
    });
  }

  const coupons: Prisma.CouponCreateInput[] = [
    {
      code: "WELCOME10",
      description: "10% off your first order (max ৳1,000).",
      type: "PERCENTAGE",
      value: "10.00",
      maxDiscountAmount: "1000.00",
      perCustomerLimit: 1,
      newCustomersOnly: true,
    },
    {
      code: "AKR500",
      description: "৳500 off orders over ৳5,000.",
      type: "FIXED_AMOUNT",
      value: "500.00",
      minOrderAmount: "5000.00",
      usageLimit: 200,
      perCustomerLimit: 2,
    },
    {
      code: "WATCH1000",
      description: "৳1,000 off watches over ৳10,000 (excludes sale items).",
      type: "FIXED_AMOUNT",
      value: "1000.00",
      scope: "CATEGORY",
      minOrderAmount: "10000.00",
      appliesToSaleItems: false,
      categories: { connect: [{ id: refs.categoryIds.get("watches")! }] },
    },
    {
      code: "SUMMER25",
      description: "Expired sample coupon.",
      type: "PERCENTAGE",
      value: "25.00",
      startsAt: new Date(now - 60 * DAY),
      endsAt: new Date(now - 30 * DAY),
    },
  ];
  for (const coupon of coupons) {
    await db.coupon.upsert({ where: { code: coupon.code }, create: coupon, update: {} });
  }
}

async function seedBanners() {
  if ((await db.banner.count()) > 0) return;
  const promo = [
    { title: "The Jewellery Edit", subtitle: "Festive pieces, now 10% off", variant: "jewellery" as const, link: "/category/jewellery", cta: "Shop jewellery" },
    { title: "Time, refined", subtitle: "Automatic, dress and smart watches", variant: "watches" as const, link: "/category/watches", cta: "Explore watches" },
    { title: "Power on the go", subtitle: "Chargers, power banks and cables", variant: "gadgets" as const, link: "/category/gadgets", cta: "Shop gadgets" },
  ];
  for (const [index, banner] of promo.entries()) {
    const image = await upload(bannerArt(1200, 900, banner.variant), "banners", 1200, 900);
    await db.banner.create({
      data: { title: banner.title, subtitle: banner.subtitle, imageUrl: image.url, linkUrl: banner.link, ctaLabel: banner.cta, placement: "HOME_PROMO", sortOrder: index * 10 },
    });
  }
  const strip = await upload(bannerArt(2400, 600, "strip"), "banners", 2400, 600);
  await db.banner.create({
    data: {
      title: "Free delivery inside Dhaka",
      subtitle: "On orders over ৳5,000 — cash on delivery available nationwide.",
      imageUrl: strip.url,
      linkUrl: "/shipping-policy",
      ctaLabel: "Delivery details",
      placement: "HOME_STRIP",
    },
  });
  const offers = await upload(bannerArt(2400, 800, "offers"), "banners", 2400, 800);
  await db.banner.create({
    data: {
      title: "This week's offers",
      subtitle: "Limited-time prices on audio, charging and jewellery.",
      imageUrl: offers.url,
      placement: "OFFERS_PAGE",
    },
  });
}

/** Homepage hero slider (HOME_HERO banners). Added once; edit them in Admin → Banners. */
async function seedHeroSlides() {
  if ((await db.banner.count({ where: { placement: "HOME_HERO" } })) > 0) return 0;
  const slides = [
    {
      variant: "hero" as const,
      eyebrow: "New season collection",
      title: "Time, refined",
      subtitle: "Automatic, dress and smart watches — 100% authentic, with warranty and delivery across Bangladesh.",
      ctaLabel: "Shop watches",
      linkUrl: "/category/watches",
      secondaryCtaLabel: "View offers",
      secondaryLinkUrl: "/offers",
      textTone: "LIGHT" as const,
    },
    {
      variant: "jewellery" as const,
      eyebrow: "Festive edit · 10% off",
      title: "Jewellery to treasure",
      subtitle: "Rings, necklaces, earrings and bracelets in 18K gold plating — gift-boxed for every occasion.",
      ctaLabel: "Shop jewellery",
      linkUrl: "/category/jewellery",
      secondaryCtaLabel: null,
      secondaryLinkUrl: null,
      textTone: "DARK" as const,
    },
    {
      variant: "gadgets" as const,
      eyebrow: "Power on the go",
      title: "Smart gadgets, everyday ease",
      subtitle: "Fast chargers, power banks, earbuds and accessories that keep up with you.",
      ctaLabel: "Shop gadgets",
      linkUrl: "/category/gadgets",
      secondaryCtaLabel: "New arrivals",
      secondaryLinkUrl: "/shop?sort=newest",
      textTone: "LIGHT" as const,
    },
  ];
  for (const [index, slide] of slides.entries()) {
    const image = await upload(bannerArt(2400, 1100, slide.variant), "banners", 2400, 1100);
    const { variant: _variant, ...data } = slide;
    await db.banner.create({ data: { ...data, imageUrl: image.url, placement: "HOME_HERO", sortOrder: index * 10 } });
  }
  return slides.length;
}

async function main() {
  console.log("Seeding AKR Lifestyle development data…");

  let adminId: string | null = null;
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const problem = adminPasswordProblem(ADMIN_PASSWORD);
    if (problem) {
      console.warn(`Skipping admin bootstrap: ${problem}`);
    } else {
      const result = await bootstrapAdmin(db, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME ?? "Administrator" });
      adminId = result.userId;
      console.log(result.created ? `• Administrator ${ADMIN_EMAIL} created` : `• Administrator ${ADMIN_EMAIL} already exists (password unchanged)`);
    }
  } else {
    console.log("• ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin bootstrap (run npm run admin:create later).");
  }

  const settingsExist = await db.setting.findUnique({ where: { key: "homepage" } });
  const hero = settingsExist ? null : await upload(bannerArt(1800, 1200, "hero"), "banners", 1800, 1200);
  await seedSettings(hero?.url ?? null);
  console.log("• Store settings");

  await seedDeliveryZones();
  console.log("• Delivery zones");

  const refs = await seedCatalogTaxonomy();
  console.log("• Categories, brands and attributes");

  const created = await seedProducts(refs, adminId);
  console.log(`• Products (${created} created)`);

  await seedPromotions(refs);
  console.log("• Discounts and coupons");

  await seedBanners();
  console.log("• Banners");

  const heroSlides = await seedHeroSlides();
  console.log(`• Homepage hero slides (${heroSlides} created)`);

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
