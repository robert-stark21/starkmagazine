import Parser from "rss-parser";
import { CATEGORIES, SOURCES, type Lang, type Source } from "./sources";
import { excerpt, stripHtml, toId } from "./text";
import { translateMany } from "./translate";
import { videoFromUrl } from "./fulltext";
import { mockArticles } from "./mock";

export const REFRESH_SECONDS = 600; // 10 minutes

export type Article = {
  id: string;
  title: string;
  link: string;
  excerpt: string;
  text: string; // plain-text body from the feed
  image?: string;
  video?: { provider: "youtube" | "vimeo" | "file" | "hls"; src: string; poster?: string };
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

/** A video attached to the feed item (media:content, enclosure, or an embedded player). */
function findVideo(item: Item): Article["video"] {
  const media = [
    ...(item.mediaContent ?? []).filter((m: any) => m?.$?.medium === "video" || m?.$?.type?.startsWith("video")).map((m: any) => m.$.url),
    item.enclosure?.type?.startsWith("video") ? item.enclosure.url : undefined,
  ];
  const html = `${item.contentEncoded ?? ""} ${item.content ?? ""}`;
  const embeds = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const u of [...media, ...embeds]) {
    const v = videoFromUrl(u);
    if (v) return v;
  }
  return undefined;
}

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

// Videos, live blogs and podcasts have no article text to show.
const NOT_ARTICLE = /\/(watch|videos?|live-blog|live|audio|podcasts?)\//i;

// Time zone names JavaScript can't parse (e.g. Sky Sports uses "BST").
const ZONES: Record<string, string> = {
  BST: "+0100", CET: "+0100", CEST: "+0200", EET: "+0200", EEST: "+0300",
  AEST: "+1000", AEDT: "+1100", ICT: "+0700", JST: "+0900", KST: "+0900",
};

function parseDate(raw?: string): string {
  if (raw) {
    let d = new Date(raw);
    if (isNaN(d.getTime())) d = new Date(raw.replace(/\b([A-Z]{3,4})$/, (z) => ZONES[z] ?? z));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
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
    if (!link || !title || NOT_ARTICLE.test(link)) return [];
    const text = stripHtml(item.contentEncoded || item.content || item.description || item.contentSnippet || "");
    return [
      {
        id: toId(link),
        title,
        link,
        excerpt: excerpt(text),
        text,
        image: findImage(item),
        video: findVideo(item),
        source: src.name,
        category: src.category,
        lang: src.lang,
        region: src.region,
        published: parseDate(item.isoDate || item.pubDate),
      },
    ];
  });
}

let memo: { at: number; articles: Article[] } | null = null;
let inflight: Promise<Article[]> | null = null;

/** All articles from every source, newest first. Cached for 10 minutes. */
export async function getAllArticles(): Promise<Article[]> {
  if (process.env.MOCK_FEEDS === "1") return mockArticles();
  // Stale-while-revalidate: once we have articles, never make a visitor wait for the feeds.
  if (memo) {
    if (Date.now() - memo.at >= REFRESH_SECONDS * 1000) void refreshFeeds();
    return memo.articles;
  }
  return refreshFeeds();
}

/** Fetches every feed, then translates titles in the background. Only one refresh runs at a time. */
export function refreshFeeds(): Promise<Article[]> {
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
    if (articles.length) {
      memo = { at: Date.now(), articles };
      void pretranslate(articles);
    } else if (memo) {
      memo = { ...memo, at: Date.now() }; // all feeds failed: keep old articles, try again later
    }
    return memo?.articles ?? [];
  })().finally(() => (inflight = null));
  return inflight;
}

let warming = false;

/** Translates titles and excerpts that list pages show, so pages find them in the cache. */
async function pretranslate(articles: Article[]) {
  if (warming) return;
  warming = true;
  try {
    for (const lang of ["vi", "en"] as Lang[]) {
      const picked = CATEGORIES.flatMap((c) =>
        articles.filter((a) => a.category === c.slug && a.lang !== lang).slice(0, c.slug === "inspiration" ? 120 : 60)
      );
      // Newest first, in small batches, so translations reach the cache (and pages) quickly.
      picked.sort((a, b) => b.published.localeCompare(a.published));
      for (let i = 0; i < picked.length; i += 15) {
        await translateMany(picked.slice(i, i + 15).flatMap((a) => [a.title, a.excerpt]), lang);
      }
    }
  } catch (e) {
    console.warn("[feeds] pre-translation failed:", String(e));
  } finally {
    warming = false;
  }
}

export function lastUpdated(): Date {
  return new Date(memo?.at ?? Date.now());
}

export async function getArticle(id: string): Promise<Article | undefined> {
  return (await getAllArticles()).find((a) => a.id === id);
}

/** Translates title and excerpt of articles whose language differs from the reader's choice. */
export async function localize(articles: Article[], lang: Lang, waitMs = 1500): Promise<Article[]> {
  const need = articles.filter((a) => a.lang !== lang);
  if (!need.length) return articles;
  const texts = need.flatMap((a) => [a.title, a.excerpt]);
  // Don't hold the page for long: after waitMs show the original text. Translation keeps
  // going in the background and fills the cache for the next visit.
  const tr = await Promise.race([
    translateMany(texts, lang),
    new Promise<string[]>((r) => setTimeout(() => r(texts), waitMs)),
  ]);
  const map = new Map(need.map((a, i) => [a.id, { title: tr[i * 2], excerpt: tr[i * 2 + 1] }]));
  return articles.map((a) => {
    const t = map.get(a.id);
    return t && t.title !== a.title ? { ...a, ...t, translated: true } : a;
  });
}
