import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllArticles, getArticle, lastUpdated, localize } from "@/lib/feeds";
import { getFullText } from "@/lib/fulltext";
import { getCategory } from "@/lib/sources";
import { getLang, UI } from "@/lib/lang";
import { readingTime, splitSentences, summarize } from "@/lib/text";
import { translateMany } from "@/lib/translate";
import { Header } from "@/components/Header";
import { ArticleCard, Meta } from "@/components/ArticleCard";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) notFound();
  const lang = await getLang();
  const t = UI[lang];
  const cat = getCategory(article.category)!;

  const full = process.env.MOCK_FEEDS === "1" ? null : await getFullText(article.link);
  let paragraphs = (full?.paragraphs ?? splitParagraphs(article.text)).slice(0, 60);
  const plain = paragraphs.join(" ");
  const minutes = readingTime(plain);
  let summary = summarize(plain, 3);
  let title = article.title;

  const needsTranslation = article.lang !== lang;
  if (needsTranslation) {
    const tr = await translateMany([title, ...summary, ...paragraphs], lang);
    title = tr[0];
    summary = tr.slice(1, 1 + summary.length);
    paragraphs = tr.slice(1 + summary.length);
  }

  const related = await localize(
    (await getAllArticles()).filter((a) => a.category === article.category && a.id !== article.id).slice(0, 4),
    lang
  );
  const image = full?.image || article.image;
  const host = new URL(article.link).hostname.replace(/^www\./, "");

  return (
    <>
      <Header lang={lang} active={article.category} updated={lastUpdated()} />
      <main className="wrap">
        <article className="detail">
          <div className="crumb">
            <Link href={`/c/${cat.slug}`} style={{ color: cat.color }}>{cat[lang]}</Link>
          </div>
          <h1>{title}</h1>
          <div className="detail-meta">
            <Meta a={article} lang={lang} showCat={false} />
            <span className="read">⏱ {minutes} {t.minRead}</span>
          </div>
          {needsTranslation && <div className="note">🌐 {t.translatedFrom}</div>}

          {summary.length > 0 && (
            <section className="summary" style={{ ["--c" as any]: cat.color }}>
              <h2>{t.summary}</h2>
              <ul>
                {summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          {image && (
            <figure className="hero-img">
              <img src={image} alt="" referrerPolicy="no-referrer" />
            </figure>
          )}

          <div className="prose">
            {!full && <p className="muted small">{t.fullUnavailable}</p>}
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <a className="orig" href={article.link} target="_blank" rel="noopener noreferrer">
            {t.readOriginal} {host} ↗
          </a>
        </article>

        {related.length > 0 && (
          <section className="sec">
            <div className="sec-h" style={{ ["--c" as any]: cat.color }}>
              <h2>{t.related}</h2>
            </div>
            <div className="grid">
              {related.map((a) => (
                <ArticleCard key={a.id} a={a} lang={lang} showCat={false} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function splitParagraphs(text: string): string[] {
  const parts = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  // One long block: group sentences into paragraphs of three.
  const s = splitSentences(text);
  const out: string[] = [];
  for (let i = 0; i < s.length; i += 3) out.push(s.slice(i, i + 3).join(" "));
  return out.length ? out : parts;
}
