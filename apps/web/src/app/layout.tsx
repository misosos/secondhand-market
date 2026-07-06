import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { NavBar } from "@/components/common/NavBar";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "중고거래 마켓",
  description: "중고거래 플랫폼 MVP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
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
