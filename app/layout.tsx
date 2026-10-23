import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getLang } from "@/lib/lang";
import { AutoRefresh, CardTransitions, Spotlight } from "@/components/client";
import { REFRESH_SECONDS } from "@/lib/feeds";
import { Manrope } from "next/font/google";

// Self-hosted at build time (no request to Google at runtime), with Vietnamese glyphs.
// latin-ext holds ă, đ, ơ, ư: preloading it avoids a layout shift when it arrives late.
const manrope = Manrope({ subsets: ["latin", "latin-ext", "vietnamese"], display: "swap", variable: "--font-sans" });

export const metadata: Metadata = {
  title: "STARK · Tin tức tổng hợp",
  description: "Công nghệ, crypto, tài chính, thể thao, design, UI/UX và nội thất, cập nhật mỗi 10 phút.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#16161a" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={manrope.variable}>
      <body>
        {children}
        <AutoRefresh seconds={REFRESH_SECONDS} />
        <Spotlight />
        <CardTransitions />
        <footer className="foot-site">
          <div className="wrap">
            © STARK · {lang === "vi" ? "Nội dung thuộc về các nguồn báo gốc." : "All content belongs to the original publishers."}
          </div>
        </footer>
      </body>
    </html>
  );
}
