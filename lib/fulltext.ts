import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export type Block =
  | { type: "text"; text: string; heading?: boolean }
  | { type: "image"; src: string; caption?: string }
  | { type: "video"; provider: "youtube" | "vimeo" | "file" | "hls"; src: string; poster?: string; caption?: string };

export type FullText = {
  blocks: Block[]; // text, images and videos in the original order
  paragraphs: string[]; // text only, for the summary and reading time
  image?: string;
};

const cache = new Map<string, { at: number; value: FullText | null }>();
const FAIL_TTL = 10 * 60_000; // retry failed pages after 10 minutes
const MAX_IMAGES = 30;
const MAX_VIDEOS = 8;

function fetchPage(url: string) {
  return fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(12000),
  });
}

/** Picks the largest candidate up to 1600px wide from a srcset ("a.jpg 640w, b.jpg 1200w"). */
function bestFromSrcset(srcset: string | null): string | undefined {
  if (!srcset) return undefined;
  const items = srcset
    .split(/,\s+(?=\S)/)
    .map((part) => {
      const [url, d] = part.trim().split(/\s+/);
      const n = parseFloat(d ?? "1");
      return { url, w: d?.endsWith("x") ? n * 800 : n || 1 };
    })
    .filter((c) => c.url);
  if (!items.length) return undefined;
  items.sort((a, b) => a.w - b.w);
  return ([...items].reverse().find((c) => c.w <= 1600) ?? items[0]).url;
}

const isUrl = (s?: string | null) => !!s && /^(https?:)?\/\/|^\/[^/]/.test(s.trim());

/**
 * Many sites lazy-load images (data-src, data-original, <picture> srcset) and Readability
 * drops images without a real src. Copy the best real URL into src before parsing.
 */
function fixImages(document: any) {
  for (const img of Array.from(document.querySelectorAll("img")) as any[]) {
    const fromPicture =
      img.parentElement?.tagName === "PICTURE"
        ? bestFromSrcset(img.parentElement.querySelector("source")?.getAttribute("srcset"))
        : undefined;
    const candidates = [
      img.getAttribute("data-original"), // full size on Tuổi Trẻ / Thanh Niên
      img.getAttribute("data-src"),
      img.getAttribute("data-lazy-src"),
      img.getAttribute("data-full-src"),
      bestFromSrcset(img.getAttribute("data-srcset")),
      bestFromSrcset(img.getAttribute("srcset")),
      fromPicture,
      img.getAttribute("src"),
    ];
    const src = candidates.find(isUrl);
    if (src) img.setAttribute("src", src.trim());
    else img.remove();
  }
  // Images hidden in <noscript> fallbacks
  for (const ns of Array.from(document.querySelectorAll("noscript")) as any[]) {
    const m = (ns.textContent ?? "").match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m && isUrl(m[1])) ns.outerHTML = `<img src="${m[1]}">`;
  }
}

const JUNK = /logo|icon|avatar|sprite|pixel|badge|emoji|banner|placeholder|spacer|blank\.|\/ads?\/|author|byline|profile|gravatar|\/users?\//i;
/** Size written in the URL: zoom/80_80, /100x100/, w=96 ... */
const SMALL_IN_URL = /(?:zoom|resize|thumb)\/(\d{2,3})_(\d{2,3})\/|\/(\d{2,3})x(\d{2,3})\/|[?&]w(?:idth)?=(\d{2,3})(?:&|$)/i;

function keepImage(img: any, src: string): boolean {
  if (/^data:|\.svg(\?|$)/i.test(src) || JUNK.test(src)) return false;
  const m = src.match(SMALL_IN_URL);
  if (m) {
    const w = +(m[1] ?? m[3] ?? m[5]);
    const h = +(m[2] ?? m[4] ?? 999);
    if (w < 200 || h < 120) return false;
  }
  if (/avatar|author|byline|profile/i.test(`${img.getAttribute("class") ?? ""} ${img.getAttribute("alt") ?? ""}`)) return false;
  const w = parseInt(img.getAttribute("width") ?? img.getAttribute("w") ?? "", 10);
  const h = parseInt(img.getAttribute("height") ?? img.getAttribute("h") ?? "", 10);
  if ((w && w < 200) || (h && h < 120)) return false;
  return true;
}

/** File name without size/query, used to spot the same image at different sizes. */
function imageKey(u: string): string {
  const [path, query = ""] = u.split("?");
  // Image proxies like /_next/image?url=... or /api/img?url=...: the real file is in the query.
  const inner = new URLSearchParams(query).get("url");
  if (inner) return imageKey(inner);
  const name = path.split("/").pop() || u;
  if (!/\.\w{3,4}$/.test(name)) return u.toLowerCase();
  return name.replace(/-\d+x\d+(?=\.)/, "").replace(/-\d{3,4}-\d{2}(?=\.)/, "").toLowerCase();
}

/**
 * Readability throws away blocks that hold only an image. Swap each image for a short
 * text marker it keeps, then turn the markers back into images after extraction.
 */
type Marked = { src: string; spare: boolean };

/** The story body on sites we know (Thanh Niên, Tuổi Trẻ, VnExpress, WordPress, ...). */
const BODY =
  ".detail-content, .detail__content, .fck_detail, .singular-content, .entry-content, .article-body, .article__body, .article-content, .post-content, [itemprop=articleBody]";
/** Share buttons, follow banners and logos, matched on whole words in the image path, class or alt. */
const SOCIAL = /(?:^|[\/_. -])(?:facebook|twitter|x-x2|mail-x2|zalo|follow|google-?news|gg-?news|share-?(?:icon|btn|button)|social-?icon|logo|icon|sprite)(?:[\/_. -]|\d|$)/i;

function markImages(document: any, pageUrl: string): Marked[] {
  const srcs: Marked[] = [];
  // Spare photos (see below) must sit in the story body when we can find it.
  const body = document.querySelector(BODY);
  const MAIN = body ? BODY : "article, main, [itemprop=articleBody]";
  const hasMain = !!document.querySelector(MAIN);
  const home = new URL(pageUrl).origin;
  for (const img of Array.from(document.querySelectorAll("img")) as any[]) {
    let src: string;
    try {
      src = new URL(img.getAttribute("src") ?? "", pageUrl).href;
      // Image proxies (/_next/image?url=...&w=384) serve a small copy; use the original file.
      const inner = new URL(src).searchParams.get("url");
      if (inner && /^https?:\/\//.test(inner)) src = inner;
    } catch {
      img.remove();
      continue;
    }
    const link = img.closest("a")?.getAttribute("href") ?? "";
    let linkUrl: URL | undefined;
    try {
      linkUrl = link ? new URL(link, pageUrl) : undefined;
    } catch {}
    const social =
      SOCIAL.test(new URL(src).pathname) ||
      SOCIAL.test(`${img.getAttribute("class") ?? ""} ${img.getAttribute("alt") ?? ""}`) ||
      // Share and follow toolbars (the image's own class is skipped: Daily Mail tags photos "img-share").
      !!img.parentElement?.closest("[class*='share'], [class*='social'], [class*='follow'], [class*='google-news']") ||
      // Banners that link to the publisher's home page or to Google News.
      (!!linkUrl && (linkUrl.href === `${home}/` || /news\.google\./.test(linkUrl.hostname)));
    if (social || !keepImage(img, src)) {
      img.remove();
      continue;
    }
    // "Spare" images sit in the main content area but outside the text Readability keeps
    // (e.g. a photo panel beside the text). They are added at the end if Readability drops them.
    const spare =
      (hasMain ? !!img.closest(MAIN) : true) &&
      !img.closest("aside, nav, footer, header") &&
      (!link || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(link));
    const marker = `⟦IMG${srcs.length}⟧`;
    srcs.push({ src, spare });
    if (img.closest("p, li, h2, h3")) {
      img.replaceWith(document.createTextNode(` ${marker} `));
    } else {
      const p = document.createElement("p");
      p.textContent = marker;
      // Pull the image out of <picture>/<a> wrappers so the marker isn't treated as a link.
      const outer = img.closest("picture, a") ?? img;
      outer.replaceWith(p);
    }
  }
  return srcs;
}

type Video = { provider: "youtube" | "vimeo" | "file" | "hls"; src: string; poster?: string; spare: boolean };

/** Turns a YouTube/Vimeo URL or video file URL into an embeddable source. */
export function videoFromUrl(raw: string | null | undefined, pageUrl?: string): Omit<Video, "spare"> | undefined {
  if (!raw) return undefined;
  let u: URL;
  try {
    u = new URL(raw.trim(), pageUrl);
  } catch {
    return undefined;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let yt: string | undefined;
  if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
    yt = u.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/)?.[1] ?? u.searchParams.get("v") ?? undefined;
  } else if (host === "youtu.be") {
    yt = u.pathname.slice(1, 12);
  }
  if (yt && /^[\w-]{11}$/.test(yt)) {
    const start = u.searchParams.get("start") ?? u.searchParams.get("t")?.replace(/s$/, "");
    return { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${yt}${start && /^\d+$/.test(start) ? `?start=${start}` : ""}` };
  }
  const vm = host.endsWith("vimeo.com") ? u.pathname.match(/\/(?:video\/)?(\d{6,})/)?.[1] : undefined;
  if (vm) return { provider: "vimeo", src: `https://player.vimeo.com/video/${vm}` };
  if (/^https?:$/.test(u.protocol) && /\.(mp4|webm|m4v|mov)(\?|$)/i.test(u.pathname)) return { provider: "file", src: u.href };
  if (/^https?:$/.test(u.protocol) && /\.m3u8(\?|$)/i.test(u.pathname)) {
    // VnExpress only serves its streams to vnexpress.net, so those go through our proxy.
    const viaProxy = /(^|\.)vnecdn\.net$/i.test(u.hostname);
    return { provider: "hls", src: viaProxy ? `/api/video?u=${encodeURIComponent(u.href)}` : u.href };
  }
  return undefined;
}

const PROMO = /reel|card|carousel|related|teaser|promo|recommend|sidebar|widget|newsletter|advert/i;

/** True when the element sits in a related-articles / promo block rather than the story. */
function inPromo(el: any): boolean {
  for (let p = el.parentElement, depth = 0; p && depth < 6; p = p.parentElement, depth++) {
    if (PROMO.test(`${p.className ?? ""} ${p.id ?? ""}`)) return true;
  }
  return false;
}

/** Like markImages, for YouTube/Vimeo iframes and <video> elements. */
function markVideos(document: any, pageUrl: string): Video[] {
  const vids: Video[] = [];
  const MAIN = "article, main, [itemprop=articleBody]";
  const hasMain = !!document.querySelector(MAIN);
  const els = Array.from(
    document.querySelectorAll("iframe, video, lite-youtube, lite-vimeo, [data-youtube-id], [data-vimeo-id]")
  ) as any[];
  for (const el of els) {
    if (!el.isConnected) continue; // removed together with an earlier match
    const tag = el.tagName;
    let v: Omit<Video, "spare"> | undefined;
    if (tag === "IFRAME") {
      v = videoFromUrl(el.getAttribute("src") || el.getAttribute("data-src") || el.getAttribute("data-lazy-src"), pageUrl);
    } else if (tag === "VIDEO") {
      const sources = [el.getAttribute("src"), el.getAttribute("data-src"), ...Array.from(el.querySelectorAll("source")).map((s: any) => s.getAttribute("src") || s.getAttribute("data-src"))];
      for (const s of sources) if ((v = videoFromUrl(s, pageUrl))) break;
      const poster = el.getAttribute("poster");
      if (v && poster) {
        try {
          v.poster = new URL(poster, pageUrl).href;
        } catch {}
      }
    } else {
      const yt = el.getAttribute("videoid") || el.getAttribute("data-youtube-id");
      const vm = el.getAttribute("data-vimeo-id") || (tag === "LITE-VIMEO" ? el.getAttribute("videoid") : null);
      v = tag !== "LITE-VIMEO" && yt ? videoFromUrl(`https://youtu.be/${yt}`) : vm ? videoFromUrl(`https://vimeo.com/${vm}`) : undefined;
    }
    if (!v || inPromo(el)) continue;
    // Only real players (not muted loops) are added at the end when Readability drops them.
    const spare =
      v.provider !== "file" && (hasMain ? !!el.closest(MAIN) : true) && !el.closest("aside, nav, footer, header");
    // Replace the whole player box (VnExpress hides the <video> inside a box with a cover image).
    const holder = el.closest(".box_embed_video_parent, figure") ?? el.closest("p, li") ?? el;
    if (!v.poster) {
      const cover = holder.querySelector?.("img")?.getAttribute("src");
      if (cover) {
        try {
          v.poster = new URL(cover, pageUrl).href;
        } catch {}
      }
    }
    const marker = `⟦VID${vids.length}⟧`;
    vids.push({ ...v, spare });
    const p = document.createElement("p");
    p.textContent = marker;
    holder.replaceWith(p);
  }
  return vids;
}

/** Per-site boxes that are never part of the story (TV schedules, subscribe tiles, share bars). */
const BOILERPLATE = [
  "[class*='live-on-sky']",
  "[class*='sdc-site-tile']",
  "[class*='sdc-article-strapline']",
  "[class*='newsletter']",
  "[class*='share-bar']",
  "[class*='social-share']",
  "[class*='related-articles']",
  "[class*='read-more']",
  "[data-testid*='newsletter']",
].join(",");

/** Author boxes: avatar plus name, e.g. Thanh Niên's "author-info". */
const BYLINE = "[class*='author'], [class*='byline'], [rel='author'], [class*='avatar'], [itemprop='author'], a[href*='/author/'], a[href*='/tac-gia/']";

function removeBoilerplate(document: any) {
  for (const el of Array.from(document.querySelectorAll(BOILERPLATE)) as any[]) {
    if (el.isConnected && !el.matches("article, main, body")) el.remove();
  }
  // Only small boxes, so a wrapper that happens to carry an "author" class keeps the story.
  for (const el of Array.from(document.querySelectorAll(BYLINE)) as any[]) {
    if (!el.isConnected || el.matches("article, main, body")) continue;
    if ((el.textContent ?? "").replace(/\s+/g, " ").trim().length <= 80) el.remove();
  }
}

/** Phrases that are almost always promos, checked on paragraphs up to 220 characters. */
const PROMO_STRONG = new RegExp(
  [
    "\\bgot sky\\?", "\\bnot got sky\\b", "\\btransfer centre\\b", "\\bfixtures (?:&|and) (?:results|scores)\\b",
    "\\bfree .{0,30}highlights\\b", "\\bsky sports (?:deals|offers)\\b", "\\b(?:with ?out|no) (?:a )?contract\\b",
    "^read (?:more|next)\\b", "^published: .{0,40}\\d{4}", "^related:", "\\bdownload (?:the|our) app\\b", "\\bclick here\\b", "\\bafter newsletter promotion\\b",
    "^(?:xem thêm|đọc thêm|tin liên quan)\\s*:", "đăng ký nhận bản tin", "tải ứng dụng",
  ].join("|"),
  "i"
);
/** Phrases that also appear in real sentences, so only very short lines are dropped. */
const PROMO_WEAK = /\blive on sky\b|\bwatch .{0,40}\blive\b|\bsign up\b|\bsubscribe\b|\bnewsletter\b|\bfollow us\b|\bkick.?off \d|theo dõi chúng tôi/i;

const DAY = "(?:mon|tues|wednes|thurs|fri|satur|sun)day";
/** Broadcast schedule lines like "Sunday 25th October 12:30pm, Kick off 2:00pm". */
const SCHEDULE = new RegExp(`^${DAY}\\s+\\d{1,2}(?:st|nd|rd|th)?\\s+\\w+.{0,40}\\d{1,2}[:.]\\d{2}\\s*(?:am|pm)`, "i");
/** Short calls to action that end in an emoji or arrow ("Watch goals FREE ▶️"). */
const ENDS_WITH_ICON = /(?:\p{Extended_Pictographic}|[▶►→➡»›⚪🔵])[️\s]*$/u;

/** True for promo lines, link lists and schedule boxes rather than article paragraphs. */
function isJunk(el: any, text: string): boolean {
  const len = text.length;
  if (len > 400) return false;
  // Mostly link text: navigation lists, "Transfer Centre LIVE! | Brighton news" and the like.
  let linked = 0;
  for (const a of Array.from(el.querySelectorAll("a")) as any[]) linked += (a.textContent ?? "").replace(/\s+/g, " ").trim().length;
  if (linked > len * 0.5) return true;
  // "Team news | FREE highlights" link pairs; plain "SCORE: 1-2 | BEST BET: ..." text stays.
  if (len < 160 && / \| /.test(text) && linked > 0) return true;
  if (len < 140 && ENDS_WITH_ICON.test(text)) return true;
  if (SCHEDULE.test(text)) return true;
  if (len < 220 && PROMO_STRONG.test(text)) return true;
  // Fixture headings ("Chelsea vs Spurs, Saturday 5.30pm, live on Sky Sports") are content.
  if (len < 110 && PROMO_WEAK.test(text) && (/^watch\b/i.test(text) || !/ vs?\.? /i.test(text))) return true;
  return false;
}

const MARKER = /⟦(IMG|VID)(\d+)⟧/;
const MARKER_G = /⟦(?:IMG|VID)\d+⟧/g;

/** Calls onText for text and onMarker for each image/video marker, in order. */
function walk(raw: string, onText: (t: string) => void, onMarker: (kind: string, i: number) => void) {
  const parts = raw.split(MARKER);
  for (let k = 0; k < parts.length; k += 3) {
    onText(parts[k]);
    if (k + 2 < parts.length) onMarker(parts[k + 1], +parts[k + 2]);
  }
}

/** Fetches the article page and extracts its text and images in order. Returns null if that fails. */
export async function getFullText(url: string): Promise<FullText | null> {
  const hit = cache.get(url);
  if (hit && (hit.value || Date.now() - hit.at < FAIL_TTL)) return hit.value;
  let result: FullText | null = null;
  try {
    // Retry once: the first connection to a site sometimes times out.
    const res = await fetchPage(url).catch(() => fetchPage(url));
    if (res.ok) {
      const { document } = parseHTML(await res.text());
      const image = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? undefined;
      removeBoilerplate(document);
      fixImages(document);
      const vids = markVideos(document, url);
      const srcs = markImages(document, url);
      const parsed = new Readability(document as any).parse();
      if (parsed?.content) {
        const { document: doc } = parseHTML(`<div id="r">${parsed.content}</div>`);
        const blocks: Block[] = [];
        const seenText = new Set<string>();
        const seenImg = new Set<string>(image ? [imageKey(image)] : []); // the hero is shown separately
        let images = 0;
        const used = new Set<number>();
        const addImage = (i: number) => {
          used.add(i);
          const src = srcs[i]?.src;
          const key = src && imageKey(src);
          if (!src || images >= MAX_IMAGES || seenImg.has(key)) return;
          seenImg.add(key);
          images++;
          blocks.push({ type: "image", src });
        };
        const seenVid = new Set<string>();
        const usedVid = new Set<number>();
        const addVideo = (i: number) => {
          usedVid.add(i);
          const v = vids[i];
          if (!v || seenVid.has(v.src) || seenVid.size >= MAX_VIDEOS) return;
          seenVid.add(v.src);
          blocks.push({ type: "video", provider: v.provider, src: v.src, poster: v.poster });
        };
        const addMarker = (kind: string, i: number) => (kind === "VID" ? addVideo(i) : addImage(i));
        const addText = (text: string, heading: boolean) => {
          text = text.replace(/\s+/g, " ").trim();
          if (text.length <= 25 || seenText.has(text)) return;
          seenText.add(text);
          blocks.push({ type: "text", text, heading });
        };
        for (const el of Array.from(doc.querySelectorAll("p, h2, h3, li, figcaption")) as any[]) {
          const tag = el.tagName;
          // Skip containers whose text is handled by a nested block (e.g. <li><p>…</p></li>).
          if (el.querySelector("p, h2, h3, li")) continue;
          const raw: string = el.textContent ?? "";
          if (tag === "FIGCAPTION") {
            walk(raw, () => {}, addMarker);
            const text = raw.replace(MARKER_G, "").replace(/\s+/g, " ").trim();
            const last = blocks[blocks.length - 1];
            if (last && last.type !== "text" && text && !last.caption) last.caption = text;
            continue;
          }
          if (el.closest("figcaption")) continue;
          if (isJunk(el, raw.replace(MARKER_G, "").replace(/\s+/g, " ").trim())) {
            walk(raw, () => {}, addMarker); // keep any photos inside, drop the text
            continue;
          }
          // Text and image markers in their original order.
          walk(raw, (t) => addText(t, tag === "H2" || tag === "H3"), addMarker);
        }
        // Photos from the main content area that Readability left out go at the end, like a gallery.
        // Story photos carry ids or dates in their path; site artwork ("ting.png") does not.
        const looksLikePhoto = (src: string) => /\d{3,}/.test(new URL(src).pathname) && !/^static\./.test(new URL(src).hostname);
        if (images < 3) srcs.forEach((m, i) => m.spare && !used.has(i) && looksLikePhoto(m.src) && addImage(i));
        vids.forEach((v, i) => v.spare && !usedVid.has(i) && addVideo(i));
        const paragraphs = blocks.flatMap((b) => (b.type === "text" ? [b.text] : []));
        if (paragraphs.join(" ").length > 300) result = { blocks, paragraphs, image };
      }
    }
  } catch {
    result = null;
  }
  cache.set(url, { at: Date.now(), value: result });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return result;
}
