import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export type FullText = { paragraphs: string[]; image?: string };

const cache = new Map<string, FullText | null>();

/** Fetches the article page and extracts its main text. Returns null if that fails. */
export async function getFullText(url: string): Promise<FullText | null> {
  if (cache.has(url)) return cache.get(url)!;
  let result: FullText | null = null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const { document } = parseHTML(await res.text());
      const image = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? undefined;
      const parsed = new Readability(document as any).parse();
      if (parsed?.content) {
        const { document: doc } = parseHTML(`<div id="r">${parsed.content}</div>`);
        const paragraphs = Array.from(doc.querySelectorAll("p, h2, h3, li"))
          .map((el: any) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
          .filter((t: string) => t.length > 25);
        if (paragraphs.join(" ").length > 300) result = { paragraphs: [...new Set(paragraphs)], image };
      }
    }
  } catch {
    result = null;
  }
  cache.set(url, result);
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return result;
}
