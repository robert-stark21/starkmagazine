import Link from "next/link";
import { CATEGORIES, type Lang } from "@/lib/sources";
import { UI } from "@/lib/lang";
import { ActiveTab, LangToggle } from "./client";
import { Logo } from "./Logo";

export function Header({ lang, active, updated }: { lang: Lang; active?: string; updated: Date }) {
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
      <nav className="cats">
        <div className="wrap row">
          <Link href="/" className={!active ? "on" : ""}>{t.home}</Link>
          {CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/c/${c.slug}`} className={active === c.slug ? "on" : ""} style={{ ["--c" as any]: c.color }}>
              {c[lang]}
            </Link>
          ))}
        </div>
      </nav>
      <ActiveTab />
    </header>
  );
}
