import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllArticles, lastUpdated, localize } from "@/lib/feeds";
import { getCategory, MOODBOARD, SOURCES } from "@/lib/sources";
import { getLang, UI } from "@/lib/lang";
import { Header } from "@/components/Header";
import { ArticleCard } from "@/components/ArticleCard";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { slug } = await params;
  const { r } = await searchParams;
  const cat = getCategory(slug);
  if (!cat) notFound();
  const lang = await getLang();
  const t = UI[lang];
  const moodboard = MOODBOARD.has(slug);

  const items = (await getAllArticles())
    .filter((a) => a.category === slug)
    .filter((a) => (r === "vn" || r === "intl" ? a.region === r : true))
    .filter((a) => (moodboard ? a.image : true))
    .slice(0, moodboard ? 120 : 60);
  const loc = await localize(items, lang);
  const sourceCount = SOURCES.filter((s) => s.category === slug).length;

  const chip = (key: string | undefined, label: string) => (
    <Link href={key ? `/c/${slug}?r=${key}` : `/c/${slug}`} className={`chip ${r === key ? "on" : ""}`}>
      {label}
    </Link>
  );

  return (
    <>
      <Header lang={lang} active={slug} updated={lastUpdated()} />
      <main className="wrap">
        <div className="page-h" style={{ ["--c" as any]: cat.color }}>
          <h1>{cat[lang]}</h1>
          <span className="muted">{sourceCount} {t.sources}</span>
          <div className="chips">
            {chip(undefined, t.all)}
            {chip("vn", `🇻🇳 ${t.vn}`)}
            {chip("intl", `🌐 ${t.intl}`)}
          </div>
        </div>
        {loc.length ? (
          <div className={moodboard ? "masonry" : "grid"}>
            {loc.map((a) => (
              <ArticleCard key={a.id} a={a} lang={lang} showCat={false} variant={moodboard ? "tile" : "default"} />
            ))}
          </div>
        ) : (
          <p className="empty">{t.noArticles}</p>
        )}
      </main>
    </>
  );
}
