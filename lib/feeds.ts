import Parser from "rss-parser";
import { SOURCES, type Lang, type Source } from "./sources";
import { excerpt, stripHtml, toId } from "./text";
import { translateMany } from "./translate";
import { mockArticles } from "./mock";

export const REFRESH_SECONDS = 600; // 10 minutes

export type Article = {
  id: string;
  title: string;
  link: string;
  excerpt: string;
  text: string; // plain-text body from the feed
  image?: string;
  source: string;
  category: string;
  lang: Lang;
  region: "vn" | "intl";
  published: string;
  translated?: boolean;
};

type Item = Record<string, any>;

const parser: Parser<{}, Item> = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

function findImage(item: Item): string | undefined {
  const mc = item.mediaContent?.find?.((m: any) => m?.$?.url)?.$?.url;
  const mt = item.mediaThumbnail?.$?.url;
  const enc = item.enclosure?.type?.startsWith("image") || /\.(jpe?g|png|webp|gif)/i.test(item.enclosure?.url ?? "")
    ? item.enclosure?.url
    : undefined;
  const html = `${item.contentEncoded ?? ""} ${item.content ?? ""} ${item.description ?? ""}`;
  const img = html.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i)?.[1];
  const url = mc || mt || enc || img;
  return url?.startsWith("//") ? `https:${url}` : url;
}

async function fetchSource(src: Source): Promise<Article[]> {
  const res = await fetch(src.url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TinTongHop/1.0; +rss reader)" },
    next: { revalidate: REFRESH_SECONDS },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`${src.name}: ${res.status}`);
  const feed = await parser.parseString(await res.text());
  return (feed.items ?? []).slice(0, 20).flatMap((item) => {
    const link = item.link?.trim();
    const title = stripHtml(item.title ?? "");
    if (!link || !title) return [];
    const text = stripHtml(item.contentEncoded || item.content || item.description || item.contentSnippet || "");
    return [
      {
        id: toId(link),
        title,
        link,
        excerpt: excerpt(text),
        text,
        image: findImage(item),
        source: src.name,
        category: src.category,
        lang: src.lang,
        region: src.region,
        published: new Date(item.isoDate || item.pubDate || Date.now()).toISOString(),
      },
    ];
  });
}

let memo: { at: number; articles: Article[] } | null = null;
let inflight: Promise<Article[]> | null = null;

/** All articles from every source, newest first. Cached for 10 minutes. */
export async function getAllArticles(): Promise<Article[]> {
  if (process.env.MOCK_FEEDS === "1") return mockArticles();
  if (memo && Date.now() - memo.at < REFRESH_SECONDS * 1000) return memo.articles;
  if (inflight) return inflight;
  inflight = (async () => {
    const results = await Promise.allSettled(SOURCES.map(fetchSource));
    results.forEach((r, i) => {
      if (r.status === "rejected") console.warn(`[feeds] ${SOURCES[i].name} failed:`, String(r.reason));
    });
    const seen = new Set<string>();
    const articles = results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
      .filter((a) => new Date(a.published).getTime() <= Date.now() + 3600_000)
      .sort((a, b) => b.published.localeCompare(a.published));
    if (articles.length) memo = { at: Date.now(), articles };
    return articles.length ? articles : memo?.articles ?? [];
  })().finally(() => (inflight = null));
  return inflight;
}

export function lastUpdated(): Date {
  return new Date(memo?.at ?? Date.now());
}

export async function getArticle(id: string): Promise<Article | undefined> {
  return (await getAllArticles()).find((a) => a.id === id);
}

/** Translates title and excerpt of articles whose language differs from the reader's choice. */
export async function localize(articles: Article[], lang: Lang): Promise<Article[]> {
  const need = articles.filter((a) => a.lang !== lang);
  if (!need.length) return articles;
  const texts = need.flatMap((a) => [a.title, a.excerpt]);
  const tr = await translateMany(texts, lang);
  const map = new Map(need.map((a, i) => [a.id, { title: tr[i * 2], excerpt: tr[i * 2 + 1] }]));
  return articles.map((a) => {
    const t = map.get(a.id);
    return t && t.title !== a.title ? { ...a, ...t, translated: true } : a;
  });
}
