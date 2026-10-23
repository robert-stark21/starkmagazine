import { parseHTML } from "linkedom";

/**
 * List pages for sources without a usable feed. Each scraper turns the site's listing of
 * award-winning websites into feed-like items (title, link, picture, date).
 */
export type ScrapedItem = { title: string; link: string; image?: string; excerpt?: string; published: string };

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" };
const DAY = 86_400_000;

async function page(url: string) {
  const r = await fetch(url, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return parseHTML(await r.text()).document;
}

/** Start of today in Vietnam, minus n days (Sites of the Day come one per day). */
const vnDayStart = (n: number) => new Date(Date.parse(new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10) + "T00:00:00+07:00") - n * DAY).toISOString();

/** Awwwards Sites of the Day: newest first; the large 880x660 screenshot from the srcset. */
async function awwwards(url: string): Promise<ScrapedItem[]> {
  const doc: any = await page(url);
  const seen = new Set<string>();
  const out: ScrapedItem[] = [];
  for (const fig of Array.from(doc.querySelectorAll("figure.figure-rollover")) as any[]) {
    const a = fig.querySelector('a[href^="/sites/"]');
    const href = a?.getAttribute("href");
    if (!href || seen.has(href)) continue;
    seen.add(href);
    const img = fig.querySelector("img");
    const srcset: string = img?.getAttribute("data-srcset") ?? img?.getAttribute("srcset") ?? "";
    const big = srcset.split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean).pop();
    out.push({
      title: img?.getAttribute("alt") || a.getAttribute("aria-label") || href.split("/").pop(),
      link: new URL(href, url).href,
      image: big || img?.getAttribute("data-src") || undefined,
      excerpt: "Awwwards Site of the Day",
      published: vnDayStart(out.length),
    });
  }
  return out;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** CSS Design Awards, Website of the Day winners: screenshot, name and the award date. */
async function cssda(url: string): Promise<ScrapedItem[]> {
  const doc: any = await page(url);
  const out: ScrapedItem[] = [];
  const now = new Date();
  for (const box of Array.from(doc.querySelectorAll(".single-project__thumbnail")) as any[]) {
    const href = box.querySelector('a[href^="/sites/"]')?.getAttribute("href");
    const img = box.querySelector('img[src*="/cdasites/"]');
    if (!href || !img) continue;
    const [mon, day] = (box.querySelector(".sp__meta__date")?.textContent ?? "").trim().toUpperCase().split(/\s+/);
    let published = now.toISOString();
    const m = MONTHS.indexOf(mon);
    if (m >= 0 && +day) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), m, +day, 5)); // noon in Vietnam
      if (d.getTime() > now.getTime() + DAY) d.setUTCFullYear(d.getUTCFullYear() - 1);
      published = d.toISOString();
    }
    out.push({
      title: (img.getAttribute("alt") ?? "").replace(/\s+website$/i, "") || href.split("/")[2],
      link: new URL(href, url).href,
      image: new URL(img.getAttribute("src"), url).href,
      excerpt: "CSS Design Awards · Website of the Day",
      published,
    });
  }
  return out;
}

export const SCRAPERS = { awwwards, cssda } as const;
export type ScraperName = keyof typeof SCRAPERS;
