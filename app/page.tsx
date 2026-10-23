import Link from "next/link";
import { imageSrcSet, SIZES } from "@/lib/img";
import { ShinyText } from "@/components/BlurText";
import { getAllArticles, hasUntranslated, lastUpdated, localize } from "@/lib/feeds";
import { RefreshSoon } from "@/components/client";
import { CATEGORIES } from "@/lib/sources";
import { getLang, UI } from "@/lib/lang";
import { Header } from "@/components/Header";
import { ArticleCard } from "@/components/ArticleCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const lang = await getLang();
  const t = UI[lang];
  const all = await getAllArticles();

  const withImg = all.filter((a) => a.image);
  const hero = withImg[0] ?? all[0];
  const side = all.filter((a) => a !== hero).slice(0, 5);
  const sections = CATEGORIES.map((c) => ({
    c,
    items: all.filter((a) => a.category === c.slug && a !== hero).slice(0, 4),
  })).filter((s) => s.items.length);

  const shown = [hero, ...side, ...sections.flatMap((s) => s.items)].filter(Boolean);
  const loc = new Map((await localize(shown, lang)).map((a) => [a.id, a]));
  const L = (a: (typeof all)[number]) => loc.get(a.id) ?? a;
  const pending = hasUntranslated([...loc.values()], lang);

  return (
    <>
      {/* Start the hero image download with the HTML (React moves this into <head>). */}
      {hero?.image && (
        <link rel="preload" as="image" href={hero.image} imageSrcSet={imageSrcSet(hero.image)} imageSizes={SIZES.hero} fetchPriority="high" />
      )}
      {pending && <RefreshSoon />}
      <Header lang={lang} updated={lastUpdated()} />
      <main className="wrap">
        {!hero ? (
          <p className="empty">{t.noArticles}</p>
        ) : (
          <section className="lead">
            <ArticleCard a={L(hero)} lang={lang} variant="hero" />
            <aside>
              <h2 className="h live">
                <ShinyText text={t.latest} />
              </h2>
              {side.map((a) => (
                <ArticleCard key={a.id} a={L(a)} lang={lang} variant="compact" />
              ))}
            </aside>
          </section>
        )}

        {sections.map(({ c, items }) => (
          <section key={c.slug} className="sec reveal">
            <div className="sec-h" style={{ ["--c" as any]: c.color }}>
              <h2>{c[lang]}</h2>
              <Link href={`/c/${c.slug}`}>{t.seeAll} →</Link>
            </div>
            <div className="grid">
              {items.map((a) => (
                <ArticleCard key={a.id} a={L(a)} lang={lang} showCat={false} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
