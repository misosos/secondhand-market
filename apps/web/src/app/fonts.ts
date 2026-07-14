import localFont from "next/font/local";
import { Oswald, JetBrains_Mono } from "next/font/google";

// Display face: condensed, stamped-numeral feel for headlines and prices —
// deliberately not the body face, used with restraint per the "가격표"
// design direction (see globals.css token comments).
export const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-face",
  display: "swap",
});

// Body face: Pretendard is the standard humanist grotesk for Korean UI text.
// Self-hosted (not the jsdelivr CDN) so there's no third-party request at
// runtime — next/font/local inlines it at build time like next/font/google.
export const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  weight: "45 920",
  variable: "--font-body-face",
  display: "swap",
});

// Utility face: tabular digits for prices, item codes, timestamps — echoes
// a price-gun sticker's monospaced numerals.
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-tag-face",
  display: "swap",
});
