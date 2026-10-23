import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllArticles, getArticle, lastUpdated, localize, type Article } from "@/lib/feeds";
import { getFullText, type Block } from "@/lib/fulltext";
import { getCategory, type Lang } from "@/lib/sources";
import { getLang, UI } from "@/lib/lang";
import { readingTime, splitSentences, summarize } from "@/lib/text";
import { translateMany } from "@/lib/translate";
import { Header } from "@/components/Header";
import { ArticleCard, Meta } from "@/components/ArticleCard";
import { ProseImage } from "@/components/client";
import { VideoEmbed } from "@/components/VideoEmbed";
import { BodySkeleton } from "@/components/Skeletons";

export const dynamic = "force-dynamic";

/**
 * The top of the article (title, meta, image) renders right away from the feed data.
 * The full text, which needs the original page and a translation, streams in below.
 */
export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) notFound();
  const lang = await getLang();
  const t = UI[lang];
  const cat = getCategory(article.category)!;
  const needsTranslation = article.lang !== lang;
  // The title is usually already translated by the list page; wait briefly otherwise.
  const [top] = await localize([article], lang, 2500);
  const host = new URL(article.link).hostname.replace(/^www\./, "");

  return (
    <>
      <Header lang={lang} active={article.category} updated={lastUpdated()} />
      <main className="wrap">
        <article className="detail">
          <div className="crumb">
            <Link href={`/c/${cat.slug}`} style={{ color: cat.color }}>{cat[lang]}</Link>
          </div>
          <h1>{top.title}</h1>
          <div className="detail-meta">
            <Meta a={article} lang={lang} showCat={false} />
          </div>
          {needsTranslation && <div className="note">🌐 {t.translatedFrom}</div>}

          {article.image && (
            <figure className="hero-img">
              <img src={article.image} alt="" referrerPolicy="no-referrer" />
            </figure>
          )}

          <Suspense fallback={<BodySkeleton />}>
            <ArticleBody article={article} lang={lang} color={cat.color} />
          </Suspense>

          <a className="orig" href={article.link} target="_blank" rel="noopener noreferrer">
            {t.readOriginal} {host} ↗
          </a>
        </article>

        <Suspense fallback={null}>
          <Related article={article} lang={lang} color={cat.color} />
        </Suspense>
      </main>
    </>
  );
}

/** Full text with images and videos, plus the quick summary. Streams in after the top. */
async function ArticleBody({ article, lang, color }: { article: Article; lang: Lang; color: string }) {
  const t = UI[lang];
  const full = process.env.MOCK_FEEDS === "1" ? null : await getFullText(article.link);
  let blocks: Block[] = limitText(full?.blocks ?? splitParagraphs(article.text).map((text) => ({ type: "text", text })), 60);
  // A video from the feed goes first when the page itself had none.
  if (article.video && !blocks.some((b) => b.type === "video")) blocks = [{ type: "video", ...article.video }, ...blocks];
  const plain = blocks.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(" ");
  const minutes = readingTime(plain);
  let summary = summarize(plain, 3);

  if (article.lang !== lang) {
    // Translate summary, paragraphs and captions in one go.
    const parts = blocks.map((b) => (b.type === "text" ? b.text : b.caption ?? ""));
    const tr = await translateMany([...summary, ...parts], lang);
    summary = tr.slice(0, summary.length);
    const out = tr.slice(summary.length);
    blocks = blocks.map((b, i) => (b.type === "text" ? { ...b, text: out[i] } : b.caption ? { ...b, caption: out[i] } : b));
  }

  // When the feed had no picture, use the page's main image.
  const hero = !article.image && full?.image;

  return (
    <>
      <p className="read-line">
        <span className="read">⏱ {minutes} {t.minRead}</span>
      </p>
      {summary.length > 0 && (
        <section className="summary" style={{ ["--c" as any]: color }}>
          <h2>{t.summary}</h2>
          <ul>
            {summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
      {hero && (
        <figure className="hero-img">
          <img src={hero} alt="" referrerPolicy="no-referrer" />
        </figure>
      )}
      <div className="prose">
        {!full && <p className="muted small">{t.fullUnavailable}</p>}
        {blocks.map((b, i) =>
          b.type === "image" ? (
            <ProseImage key={i} src={b.src} caption={b.caption} />
          ) : b.type === "video" ? (
            <VideoEmbed key={i} {...b} />
          ) : b.heading ? (
            <h2 key={i}>{b.text}</h2>
          ) : (
            <p key={i}>{b.text}</p>
          )
        )}
      </div>
    </>
  );
}

async function Related({ article, lang, color }: { article: Article; lang: Lang; color: string }) {
  const t = UI[lang];
  const related = await localize(
    (await getAllArticles()).filter((a) => a.category === article.category && a.id !== article.id).slice(0, 4),
    lang
  );
  if (!related.length) return null;
  return (
    <section className="sec">
      <div className="sec-h" style={{ ["--c" as any]: color }}>
        <h2>{t.related}</h2>
      </div>
      <div className="grid">
        {related.map((a) => (
          <ArticleCard key={a.id} a={a} lang={lang} showCat={false} />
        ))}
      </div>
    </section>
  );
}

/** Keeps at most `max` text blocks (images in between are kept). */
function limitText(blocks: Block[], max: number): Block[] {
  let n = 0;
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.type === "text" && ++n > max) break;
    out.push(b);
  }
  return out;
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
