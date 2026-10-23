import Link from "next/link";
import { CATEGORIES, type Lang } from "@/lib/sources";
import { UI } from "@/lib/lang";
import { CatNav, LangToggle } from "./client";
import { Logo } from "./Logo";

export function Header({ lang, updated }: { lang: Lang; updated: Date }) {
  const t = UI[lang];
  const today = new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-US", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
  const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(updated);
  return (
    <header className="site">
      <div className="wrap top">
        <Link href="/" className="brand" aria-label="STARK">
          <Logo className="logo" />
        </Link>
        <div className="tag">{t.tagline}</div>
        <div className="right">
          <span className="date"><span className="cap">{today}</span> · {t.updated} {time}</span>
          <LangToggle lang={lang} />
        </div>
      </div>
      <CatNav
        items={[
          { href: "/", slug: "", label: t.home },
          ...CATEGORIES.map((c) => ({ href: `/c/${c.slug}`, slug: c.slug, label: c[lang], color: c.color })),
        ]}
      />
    </header>
  );
}
