import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { NavBar } from "@/components/common/NavBar";
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
    <html lang="ko" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Superellipse (|x|^n + |y|^n = 1, n=5) squircle clip-path, referenced
            as `clip-path: url(#squircle)` — scales to any element's box since
            it's defined in objectBoundingBox units. */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <clipPath id="squircle" clipPathUnits="objectBoundingBox">
              <path d="M 1.00000,0.50000 L 0.99957,0.66796 L 0.99828,0.72144 L 0.99613,0.76005 L 0.99311,0.79118 L 0.98921,0.81755 L 0.98441,0.84049 L 0.97870,0.86079 L 0.97204,0.87893 L 0.96442,0.89524 L 0.95578,0.90997 L 0.94609,0.92327 L 0.93528,0.93528 L 0.92327,0.94609 L 0.90997,0.95578 L 0.89524,0.96442 L 0.87893,0.97204 L 0.86079,0.97870 L 0.84049,0.98441 L 0.81755,0.98921 L 0.79118,0.99311 L 0.76005,0.99613 L 0.72144,0.99828 L 0.66796,0.99957 L 0.50000,1.00000 L 0.33204,0.99957 L 0.27856,0.99828 L 0.23995,0.99613 L 0.20882,0.99311 L 0.18245,0.98921 L 0.15951,0.98441 L 0.13921,0.97870 L 0.12107,0.97204 L 0.10476,0.96442 L 0.09003,0.95578 L 0.07673,0.94609 L 0.06472,0.93528 L 0.05391,0.92327 L 0.04422,0.90997 L 0.03558,0.89524 L 0.02796,0.87893 L 0.02130,0.86079 L 0.01559,0.84049 L 0.01079,0.81755 L 0.00689,0.79118 L 0.00387,0.76005 L 0.00172,0.72144 L 0.00043,0.66796 L 0.00000,0.50000 L 0.00043,0.33204 L 0.00172,0.27856 L 0.00387,0.23995 L 0.00689,0.20882 L 0.01079,0.18245 L 0.01559,0.15951 L 0.02130,0.13921 L 0.02796,0.12107 L 0.03558,0.10476 L 0.04422,0.09003 L 0.05391,0.07673 L 0.06472,0.06472 L 0.07673,0.05391 L 0.09003,0.04422 L 0.10476,0.03558 L 0.12107,0.02796 L 0.13921,0.02130 L 0.15951,0.01559 L 0.18245,0.01079 L 0.20882,0.00689 L 0.23995,0.00387 L 0.27856,0.00172 L 0.33204,0.00043 L 0.50000,0.00000 L 0.66796,0.00043 L 0.72144,0.00172 L 0.76005,0.00387 L 0.79118,0.00689 L 0.81755,0.01079 L 0.84049,0.01559 L 0.86079,0.02130 L 0.87893,0.02796 L 0.89524,0.03558 L 0.90997,0.04422 L 0.92327,0.05391 L 0.93528,0.06472 L 0.94609,0.07673 L 0.95578,0.09003 L 0.96442,0.10476 L 0.97204,0.12107 L 0.97870,0.13921 L 0.98441,0.15951 L 0.98921,0.18245 L 0.99311,0.20882 L 0.99613,0.23995 L 0.99828,0.27856 L 0.99957,0.33204 Z" />
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
