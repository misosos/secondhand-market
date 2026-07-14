import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { NavBar } from "@/components/common/NavBar";
import { oswald, pretendard, jetbrainsMono } from "./fonts";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "중고거래 마켓",
  description: "중고거래 플랫폼 MVP",
};

// Runs before hydration so the stored theme (if any) applies before first
// paint — otherwise the page would flash the system-preference theme and
// then snap to the user's chosen one. `suppressHydrationWarning` on <html>
// below tells React not to complain that this attribute wasn't there in
// the server-rendered markup.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${oswald.variable} ${pretendard.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Swing-tag clip-path — a price tag's silhouette (notched point on
            the left, punched grommet hole), referenced as
            `clip-path: url(#tag)`. objectBoundingBox units so it scales to
            any element's box. The hole is cut via the even-odd fill rule. */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <clipPath id="tag" clipPathUnits="objectBoundingBox">
              <path
                fillRule="evenodd"
                d="M 0.1,0 L 1,0 L 1,1 L 0.1,1 L 0,0.5 Z
                   M 0.16,0.42 a 0.08,0.08 0 1 0 0.0001,0 Z"
              />
            </clipPath>
          </defs>
        </svg>
        <AuthProvider>
          <NavBar />
          <main className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
