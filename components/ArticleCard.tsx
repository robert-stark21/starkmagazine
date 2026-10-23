import Link from "next/link";
import type { Article } from "@/lib/feeds";
import { getCategory, type Lang } from "@/lib/sources";
import { timeAgo, UI } from "@/lib/lang";
import { readingTime } from "@/lib/text";
import { Thumb } from "./client";

export function Meta({ a, lang, showCat = true }: { a: Article; lang: Lang; showCat?: boolean }) {
  const cat = getCategory(a.category)!;
  return (
    <div className="meta">
      {showCat && (
        <span className="badge" style={{ color: cat.color, background: `${cat.color}14` }}>
          {cat[lang]}
        </span>
      )}
      <span className="src">{a.region === "vn" ? "🇻🇳" : "🌐"} {a.source}</span>
      <span className="dot">·</span>
      <time dateTime={a.published}>{timeAgo(a.published, lang)}</time>
    </div>
  );
}

export function ArticleCard({
  a,
  lang,
  variant = "default",
  showCat = true,
}: {
  a: Article;
  lang: Lang;
  variant?: "hero" | "default" | "compact";
  showCat?: boolean;
}) {
  const cat = getCategory(a.category)!;
  return (
    <article className={`card ${variant}`}>
      <Link href={`/a/${a.id}`} className="cover">
        {variant !== "compact" && <Thumb src={a.image} alt="" color={cat.color} label={cat[lang]} />}
        <div className="body">
          <Meta a={a} lang={lang} showCat={showCat} />
          <h3>{a.title}</h3>
          {variant !== "compact" && a.excerpt && <p>{a.excerpt}</p>}
          <div className="foot">
            {readingTime(a.text)} {UI[lang].minRead}
            {a.translated && <span className="tr">{lang === "vi" ? "Đã dịch" : "Translated"}</span>}
          </div>
        </div>
      </Link>
    </article>
  );
}
