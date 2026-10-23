import type { Article } from "./feeds";
import { prepareBody } from "./article";
import { CATEGORIES, type Lang } from "./sources";

/**
 * Warm-up: extracts and translates articles before anyone opens them, so the article page
 * renders from the caches. Runs a few at a time in the background; each article is done
 * once per language (failures may be retried later).
 */
const CONCURRENCY = 5;
const done = new Set<string>();
const queue: { article: Article; lang: Lang }[] = [];
let running = 0;

function pump() {
  while (running < CONCURRENCY && queue.length) {
    const { article, lang } = queue.shift()!;
    running++;
    prepareBody(article, lang)
      .catch(() => done.delete(`${lang}|${article.id}`)) // let a later warm-up try again
      .finally(() => {
        running--;
        pump();
      });
  }
}

/** Queues articles for warming. `first` puts them ahead of the background batch. */
export function warm(articles: Article[], lang: Lang, first = false) {
  const fresh = articles.filter((a) => !done.has(`${lang}|${a.id}`));
  for (const a of fresh) done.add(`${lang}|${a.id}`);
  const jobs = fresh.map((article) => ({ article, lang }));
  if (first) queue.unshift(...jobs);
  else queue.push(...jobs);
  if (done.size > 5000) done.clear();
  pump();
}

/** After a feed refresh: the newest few stories of every section, in Vietnamese. */
export function warmLatest(articles: Article[], perSection = 12) {
  const picked = CATEGORIES.flatMap((c) => articles.filter((a) => a.category === c.slug).slice(0, perSection));
  warm(picked, "vi");
}
