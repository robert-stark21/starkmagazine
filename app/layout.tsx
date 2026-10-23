import "./globals.css";
import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import { AutoRefresh } from "@/components/client";
import { REFRESH_SECONDS } from "@/lib/feeds";

export const metadata: Metadata = {
  title: "Magazine · Tin tức tổng hợp",
  description: "Công nghệ, crypto, tài chính, thể thao, design, UI/UX và nội thất, cập nhật mỗi 10 phút.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body>
        {children}
        <AutoRefresh seconds={REFRESH_SECONDS} />
        <footer className="foot-site">
          <div className="wrap">
            © Magazine · {lang === "vi" ? "Nội dung thuộc về các nguồn báo gốc." : "All content belongs to the original publishers."}
          </div>
        </footer>
      </body>
    </html>
  );
}
