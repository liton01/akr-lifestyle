/**
 * Generates original, on-brand placeholder artwork for development seed data.
 * No third-party photography is used. Replace these with real product photos in Admin.
 */

export type ArtKind =
  | "headphones"
  | "earbuds"
  | "speaker"
  | "bulb"
  | "plug"
  | "keyboard"
  | "powerbank"
  | "charger"
  | "cable"
  | "stand"
  | "camera"
  | "watch"
  | "watch-slim"
  | "smartwatch"
  | "ring"
  | "necklace"
  | "earrings"
  | "bracelet"
  | "wallet"
  | "bag"
  | "sunglasses"
  | "belt";

const INK = "#171717";
const GOLD = "#C6A66B";
const GOLD_DARK = "#A88A50";
const GOLD_LIGHT = "#E8D6AE";
const IVORY = "#F6F1E7";
const CHARCOAL = "#424242";

type ArtOptions = { body?: string; accent?: string; dark?: boolean; angle?: number };

function frame(content: string, opts: ArtOptions): string {
  const bgA = opts.dark ? "#232323" : "#FBF8F2";
  const bgB = opts.dark ? INK : "#EFE6D4";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="${bgA}"/>
      <stop offset="100%" stop-color="${bgB}"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GOLD_LIGHT}"/>
      <stop offset="50%" stop-color="${GOLD}"/>
      <stop offset="100%" stop-color="${GOLD_DARK}"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="28"/></filter>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <circle cx="600" cy="560" r="390" fill="none" stroke="${GOLD}" stroke-opacity="0.18" stroke-width="2"/>
  <ellipse cx="600" cy="1010" rx="330" ry="38" fill="#000" opacity="${opts.dark ? 0.5 : 0.16}" filter="url(#soft)"/>
  <g transform="rotate(${opts.angle ?? 0} 600 600)">${content}</g>
</svg>`;
}

function shapes(kind: ArtKind, body: string, accent: string): string {
  switch (kind) {
    case "headphones":
      return `<path d="M330 640 C330 330 870 330 870 640" fill="none" stroke="${body}" stroke-width="48" stroke-linecap="round"/>
        <path d="M352 600 C360 380 840 380 848 600" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round" opacity="0.8"/>
        <rect x="260" y="590" width="150" height="250" rx="70" fill="${body}"/><rect x="790" y="590" width="150" height="250" rx="70" fill="${body}"/>
        <rect x="380" y="620" width="40" height="190" rx="20" fill="${accent}"/><rect x="780" y="620" width="40" height="190" rx="20" fill="${accent}"/>
        <rect x="275" y="610" width="120" height="70" rx="35" fill="url(#sheen)"/>`;
    case "earbuds":
      return `<rect x="380" y="560" width="440" height="300" rx="150" fill="${body}"/>
        <rect x="380" y="560" width="440" height="120" rx="60" fill="url(#sheen)"/>
        <line x1="390" y1="690" x2="810" y2="690" stroke="${accent}" stroke-width="6"/>
        <circle cx="600" cy="780" r="10" fill="${accent}"/>
        <g transform="translate(410 300) rotate(-18)"><circle cx="60" cy="60" r="70" fill="${body}" stroke="${accent}" stroke-width="10"/><rect x="40" y="90" width="44" height="170" rx="22" fill="${body}"/></g>
        <g transform="translate(700 270) rotate(18)"><circle cx="60" cy="60" r="70" fill="${body}" stroke="${accent}" stroke-width="10"/><rect x="40" y="90" width="44" height="170" rx="22" fill="${body}"/></g>`;
    case "speaker":
      return `<rect x="420" y="300" width="360" height="600" rx="170" fill="${body}"/>
        <rect x="440" y="320" width="320" height="200" rx="100" fill="url(#sheen)"/>
        ${Array.from({ length: 9 }, (_, r) => Array.from({ length: 6 }, (_, c) => `<circle cx="${480 + c * 48}" cy="${430 + r * 42}" r="9" fill="${accent}" opacity="0.75"/>`).join("")).join("")}
        <rect x="560" y="840" width="80" height="14" rx="7" fill="${accent}"/>`;
    case "bulb":
      return `<circle cx="600" cy="480" r="220" fill="${IVORY}" stroke="${body}" stroke-width="14"/>
        <circle cx="600" cy="480" r="150" fill="${accent}" opacity="0.25"/>
        <path d="M520 680 L680 680 L660 760 L540 760 Z" fill="${body}"/>
        ${[0, 1, 2, 3].map((i) => `<rect x="${535 + i * 0}" y="${770 + i * 34}" width="130" height="22" rx="11" fill="${accent}"/>`).join("")}`;
    case "plug":
      return `<rect x="400" y="340" width="400" height="460" rx="90" fill="${body}"/>
        <rect x="420" y="360" width="360" height="160" rx="70" fill="url(#sheen)"/>
        <circle cx="600" cy="560" r="90" fill="none" stroke="${accent}" stroke-width="16"/>
        <line x1="600" y1="470" x2="600" y2="545" stroke="${accent}" stroke-width="16" stroke-linecap="round"/>
        <rect x="520" y="800" width="30" height="110" rx="10" fill="${CHARCOAL}"/><rect x="650" y="800" width="30" height="110" rx="10" fill="${CHARCOAL}"/>`;
    case "keyboard":
      return `<rect x="190" y="470" width="820" height="300" rx="36" fill="${body}"/>
        ${Array.from({ length: 4 }, (_, r) => Array.from({ length: 12 }, (_, c) => `<rect x="${222 + c * 64}" y="${500 + r * 62}" width="52" height="48" rx="10" fill="${r === 3 && c > 2 && c < 9 ? accent : CHARCOAL}" opacity="0.95"/>`).join("")).join("")}
        <ellipse cx="900" cy="880" rx="70" ry="100" fill="${body}"/><line x1="900" y1="790" x2="900" y2="850" stroke="${accent}" stroke-width="8"/>`;
    case "powerbank":
      return `<rect x="380" y="260" width="440" height="700" rx="70" fill="${body}"/>
        <rect x="400" y="280" width="400" height="220" rx="60" fill="url(#sheen)"/>
        <path d="M620 470 L540 620 L605 620 L575 760 L670 580 L605 580 Z" fill="${accent}"/>
        ${[0, 1, 2, 3].map((i) => `<circle cx="${540 + i * 40}" cy="860" r="11" fill="${i < 3 ? accent : CHARCOAL}"/>`).join("")}`;
    case "charger":
      return `<rect x="420" y="380" width="360" height="400" rx="70" fill="${body}"/>
        <rect x="440" y="400" width="320" height="140" rx="60" fill="url(#sheen)"/>
        <rect x="490" y="300" width="40" height="100" rx="12" fill="${CHARCOAL}"/><rect x="670" y="300" width="40" height="100" rx="12" fill="${CHARCOAL}"/>
        <text x="600" y="640" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="96" font-weight="700" fill="${accent}">65W</text>
        <path d="M600 780 C600 900 820 860 860 960" fill="none" stroke="${body}" stroke-width="26" stroke-linecap="round"/>`;
    case "cable":
      return `<path d="M300 380 C520 240 760 300 720 520 C680 740 380 640 420 840 C450 980 800 960 900 820" fill="none" stroke="${body}" stroke-width="34" stroke-linecap="round"/>
        <path d="M300 380 C520 240 760 300 720 520 C680 740 380 640 420 840 C450 980 800 960 900 820" fill="none" stroke="${accent}" stroke-width="6" stroke-dasharray="14 18" stroke-linecap="round"/>
        <rect x="230" y="330" width="120" height="70" rx="20" fill="${CHARCOAL}" transform="rotate(-30 290 365)"/>
        <rect x="860" y="770" width="120" height="70" rx="20" fill="${CHARCOAL}" transform="rotate(-50 920 805)"/>`;
    case "stand":
      return `<path d="M380 900 L820 900 L760 860 L440 860 Z" fill="${body}"/>
        <rect x="575" y="520" width="50" height="350" rx="20" fill="${body}"/>
        <rect x="430" y="230" width="340" height="420" rx="46" fill="${CHARCOAL}" transform="rotate(-12 600 440)"/>
        <rect x="452" y="252" width="296" height="376" rx="34" fill="${INK}" transform="rotate(-12 600 440)"/>
        <circle cx="600" cy="440" r="70" fill="none" stroke="${accent}" stroke-width="12" transform="rotate(-12 600 440)"/>`;
    case "camera":
      return `<rect x="330" y="400" width="540" height="400" rx="60" fill="${body}"/>
        <rect x="350" y="420" width="500" height="120" rx="50" fill="url(#sheen)"/>
        <circle cx="600" cy="610" r="150" fill="${CHARCOAL}"/><circle cx="600" cy="610" r="110" fill="${INK}" stroke="${accent}" stroke-width="12"/>
        <circle cx="560" cy="570" r="26" fill="#ffffff" opacity="0.35"/>
        <rect x="390" y="360" width="120" height="50" rx="16" fill="${accent}"/><circle cx="800" cy="470" r="16" fill="#d64545"/>`;
    case "watch":
    case "watch-slim": {
      const r = kind === "watch" ? 210 : 165;
      const strapW = kind === "watch" ? 180 : 130;
      return `<rect x="${600 - strapW / 2}" y="140" width="${strapW}" height="${360 - r / 2}" rx="40" fill="${body}"/>
        <rect x="${600 - strapW / 2}" y="${700 + r / 2 - 60}" width="${strapW}" height="${360 - r / 2}" rx="40" fill="${body}"/>
        <circle cx="600" cy="600" r="${r + 34}" fill="url(#gold)"/>
        <circle cx="600" cy="600" r="${r}" fill="${accent}"/>
        ${Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          const x1 = 600 + Math.sin(a) * (r - 18);
          const y1 = 600 - Math.cos(a) * (r - 18);
          const x2 = 600 + Math.sin(a) * (r - (i % 3 === 0 ? 58 : 40));
          const y2 = 600 - Math.cos(a) * (r - (i % 3 === 0 ? 58 : 40));
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${GOLD}" stroke-width="${i % 3 === 0 ? 12 : 6}" stroke-linecap="round"/>`;
        }).join("")}
        <line x1="600" y1="600" x2="${600 - r * 0.42}" y2="${600 - r * 0.32}" stroke="${GOLD}" stroke-width="14" stroke-linecap="round"/>
        <line x1="600" y1="600" x2="${600 + r * 0.55}" y2="${600 - r * 0.5}" stroke="${GOLD}" stroke-width="9" stroke-linecap="round"/>
        <circle cx="600" cy="600" r="16" fill="${GOLD}"/>
        <rect x="${600 + r + 26}" y="580" width="30" height="40" rx="8" fill="url(#gold)"/>`;
    }
    case "smartwatch":
      return `<rect x="500" y="130" width="200" height="300" rx="50" fill="${body}"/>
        <rect x="500" y="770" width="200" height="300" rx="50" fill="${body}"/>
        <rect x="380" y="330" width="440" height="540" rx="120" fill="${CHARCOAL}"/>
        <rect x="410" y="360" width="380" height="480" rx="96" fill="${INK}"/>
        <text x="600" y="610" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="700" fill="${accent}">10:09</text>
        <circle cx="510" cy="720" r="34" fill="none" stroke="#3aa76d" stroke-width="10"/>
        <circle cx="600" cy="720" r="34" fill="none" stroke="${accent}" stroke-width="10"/>
        <circle cx="690" cy="720" r="34" fill="none" stroke="#4b8bd6" stroke-width="10"/>
        <rect x="815" y="470" width="30" height="90" rx="12" fill="${accent}"/>`;
    case "ring":
      return `<ellipse cx="600" cy="690" rx="250" ry="250" fill="none" stroke="url(#gold)" stroke-width="56"/>
        <ellipse cx="600" cy="690" rx="250" ry="250" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="10"/>
        <path d="M600 280 L700 380 L600 520 L500 380 Z" fill="${accent}" stroke="#ffffff" stroke-width="8" opacity="0.95"/>
        <path d="M500 380 L700 380 M600 280 L560 380 L600 520 L640 380 Z" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.8"/>
        <rect x="560" y="430" width="80" height="40" fill="url(#gold)"/>`;
    case "necklace":
      return `<path d="M300 240 C320 640 880 640 900 240" fill="none" stroke="url(#gold)" stroke-width="14" stroke-dasharray="4 14" stroke-linecap="round"/>
        <path d="M300 240 C320 640 880 640 900 240" fill="none" stroke="${GOLD_DARK}" stroke-width="5"/>
        <line x1="600" y1="560" x2="600" y2="640" stroke="url(#gold)" stroke-width="10"/>
        <circle cx="600" cy="740" r="100" fill="${accent}"/>
        <circle cx="570" cy="705" r="30" fill="#ffffff" opacity="0.6"/>`;
    case "earrings":
      return `${[420, 780]
        .map(
          (cx) => `<circle cx="${cx}" cy="300" r="26" fill="url(#gold)"/>
          <circle cx="${cx}" cy="560" r="190" fill="none" stroke="url(#gold)" stroke-width="34"/>
          <circle cx="${cx}" cy="752" r="32" fill="${accent}"/>`,
        )
        .join("")}`;
    case "bracelet":
      return `<ellipse cx="600" cy="620" rx="340" ry="220" fill="none" stroke="url(#gold)" stroke-width="40"/>
        ${Array.from({ length: 22 }, (_, i) => {
          const a = (i / 22) * Math.PI * 2;
          return `<circle cx="${(600 + Math.cos(a) * 340).toFixed(1)}" cy="${(620 + Math.sin(a) * 220).toFixed(1)}" r="20" fill="${accent}" stroke="#fff" stroke-width="4"/>`;
        }).join("")}`;
    case "wallet":
      return `<rect x="300" y="380" width="600" height="440" rx="44" fill="${body}"/>
        <rect x="300" y="380" width="600" height="140" rx="44" fill="url(#sheen)"/>
        <rect x="330" y="410" width="540" height="380" rx="30" fill="none" stroke="${accent}" stroke-width="5" stroke-dasharray="14 12"/>
        <rect x="640" y="540" width="260" height="160" rx="30" fill="${CHARCOAL}"/>
        <circle cx="700" cy="620" r="22" fill="url(#gold)"/>`;
    case "bag":
      return `<path d="M470 470 C470 250 730 250 730 470" fill="none" stroke="${CHARCOAL}" stroke-width="30" stroke-linecap="round"/>
        <path d="M300 460 L900 460 L860 940 L340 940 Z" fill="${body}"/>
        <path d="M300 460 L900 460 L890 560 L310 560 Z" fill="url(#sheen)"/>
        <rect x="540" y="600" width="120" height="70" rx="12" fill="url(#gold)"/>`;
    case "sunglasses":
      return `<path d="M200 520 C200 470 520 470 540 520 C560 700 420 760 330 740 C240 720 200 640 200 520 Z" fill="${body}" stroke="url(#gold)" stroke-width="16"/>
        <path d="M1000 520 C1000 470 680 470 660 520 C640 700 780 760 870 740 C960 720 1000 640 1000 520 Z" fill="${body}" stroke="url(#gold)" stroke-width="16"/>
        <path d="M540 540 C580 500 620 500 660 540" fill="none" stroke="url(#gold)" stroke-width="16"/>
        <path d="M250 540 C300 520 360 520 420 560" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="14" stroke-linecap="round"/>
        <path d="M710 540 C760 520 820 520 880 560" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="14" stroke-linecap="round"/>`;
    case "belt":
      return `<path d="M250 760 C250 400 950 400 950 760" fill="none" stroke="${body}" stroke-width="90"/>
        <rect x="500" y="660" width="200" height="190" rx="24" fill="none" stroke="url(#gold)" stroke-width="28"/>
        <line x1="600" y1="680" x2="600" y2="830" stroke="url(#gold)" stroke-width="16"/>
        ${[0, 1, 2].map((i) => `<circle cx="${790 + i * 50}" cy="${560 + i * 40}" r="9" fill="${accent}"/>`).join("")}`;
  }
}

export function productArt(kind: ArtKind, opts: ArtOptions = {}): string {
  const body = opts.body ?? INK;
  const accent = opts.accent ?? GOLD;
  return frame(shapes(kind, body, accent), opts);
}

/** Wide abstract hero / banner artwork. */
export function bannerArt(width: number, height: number, variant: "hero" | "jewellery" | "watches" | "gadgets" | "strip" | "offers"): string {
  const dark = variant !== "jewellery" && variant !== "strip";
  const bg = dark ? INK : IVORY;
  const motif =
    variant === "jewellery"
      ? `<circle cx="${width * 0.72}" cy="${height * 0.55}" r="${height * 0.3}" fill="none" stroke="url(#gold)" stroke-width="${height * 0.05}"/>
         <path d="M${width * 0.72} ${height * 0.12} l${height * 0.1} ${height * 0.1} l-${height * 0.1} ${height * 0.14} l-${height * 0.1} -${height * 0.14} Z" fill="${CHARCOAL}"/>`
      : variant === "watches"
        ? `<circle cx="${width * 0.74}" cy="${height * 0.5}" r="${height * 0.34}" fill="url(#gold)"/>
           <circle cx="${width * 0.74}" cy="${height * 0.5}" r="${height * 0.29}" fill="${INK}"/>
           <line x1="${width * 0.74}" y1="${height * 0.5}" x2="${width * 0.74 - height * 0.12}" y2="${height * 0.4}" stroke="${GOLD}" stroke-width="${height * 0.02}" stroke-linecap="round"/>
           <line x1="${width * 0.74}" y1="${height * 0.5}" x2="${width * 0.74 + height * 0.16}" y2="${height * 0.36}" stroke="${GOLD}" stroke-width="${height * 0.012}" stroke-linecap="round"/>`
        : variant === "gadgets"
          ? `<rect x="${width * 0.62}" y="${height * 0.18}" width="${height * 0.36}" height="${height * 0.64}" rx="${height * 0.06}" fill="${CHARCOAL}"/>
             <path d="M${width * 0.62 + height * 0.2} ${height * 0.34} l-${height * 0.08} ${height * 0.16} h${height * 0.07} l-${height * 0.03} ${height * 0.16} l${height * 0.1} -${height * 0.2} h-${height * 0.07} Z" fill="url(#gold)"/>`
          : variant === "hero"
            ? `<circle cx="${width * 0.7}" cy="${height * 0.52}" r="${height * 0.36}" fill="url(#gold)" opacity="0.92"/>
               <circle cx="${width * 0.7}" cy="${height * 0.52}" r="${height * 0.3}" fill="${INK}"/>
               <circle cx="${width * 0.7}" cy="${height * 0.52}" r="${height * 0.26}" fill="none" stroke="${GOLD}" stroke-opacity="0.5" stroke-width="3"/>
               ${Array.from({ length: 12 }, (_, i) => {
                 const a = (i * Math.PI) / 6;
                 const r1 = height * 0.24;
                 const r2 = height * (i % 3 === 0 ? 0.19 : 0.21);
                 const cx = width * 0.7;
                 const cy = height * 0.52;
                 return `<line x1="${(cx + Math.sin(a) * r1).toFixed(1)}" y1="${(cy - Math.cos(a) * r1).toFixed(1)}" x2="${(cx + Math.sin(a) * r2).toFixed(1)}" y2="${(cy - Math.cos(a) * r2).toFixed(1)}" stroke="${GOLD}" stroke-width="${i % 3 === 0 ? 8 : 4}" stroke-linecap="round"/>`;
               }).join("")}
               <line x1="${width * 0.7}" y1="${height * 0.52}" x2="${width * 0.7 - height * 0.1}" y2="${height * 0.44}" stroke="${GOLD}" stroke-width="10" stroke-linecap="round"/>
               <line x1="${width * 0.7}" y1="${height * 0.52}" x2="${width * 0.7 + height * 0.14}" y2="${height * 0.4}" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/>
               <path d="M${width * 0.42} ${height * 0.86} C${width * 0.42} ${height * 0.5} ${width * 0.58} ${height * 0.5} ${width * 0.58} ${height * 0.86}" fill="none" stroke="${CHARCOAL}" stroke-width="${height * 0.03}" stroke-linecap="round"/>`
            : `<circle cx="${width * 0.85}" cy="${height * 0.5}" r="${height * 0.6}" fill="url(#gold)" opacity="0.35"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GOLD_LIGHT}"/><stop offset="55%" stop-color="${GOLD}"/><stop offset="100%" stop-color="${GOLD_DARK}"/>
    </linearGradient>
    <radialGradient id="glow" cx="70%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${dark ? "#2b2620" : "#ffffff"}"/><stop offset="100%" stop-color="${bg}"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  ${Array.from({ length: 6 }, (_, i) => `<circle cx="${width * 0.7}" cy="${height * 0.52}" r="${height * (0.42 + i * 0.12)}" fill="none" stroke="${GOLD}" stroke-opacity="${0.16 - i * 0.02}" stroke-width="2"/>`).join("")}
  ${motif}
</svg>`;
}
