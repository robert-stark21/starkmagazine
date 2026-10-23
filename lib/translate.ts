import type { Lang } from "./sources";

const cache = new Map<string, string>();
const MAX_CHUNK = 3500;

async function callGoogle(text: string, target: Lang): Promise<string> {
  const body = new URLSearchParams({ q: text });
  const res = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) throw new Error(`translate ${res.status}`);
  const data = await res.json();
  return (data[0] as [string][]).map((seg) => seg[0]).join("");
}

/** Translates many short texts, batching them into few requests. Falls back to the original on error. */
export async function translateMany(texts: string[], target: Lang): Promise<string[]> {
  const out = texts.slice();
  const todo: number[] = [];
  texts.forEach((t, i) => {
    if (!t.trim()) return;
    const hit = cache.get(`${target}|${t}`);
    if (hit !== undefined) out[i] = hit;
    else todo.push(i);
  });

  const chunks: number[][] = [];
  let cur: number[] = [];
  let len = 0;
  for (const i of todo) {
    const l = texts[i].length + 1;
    if (cur.length && len + l > MAX_CHUNK) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(i);
    len += l;
  }
  if (cur.length) chunks.push(cur);

  await Promise.all(
    chunks.map(async (idx) => {
      try {
        const joined = idx.map((i) => texts[i].replace(/\n+/g, " ")).join("\n");
        const translated = (await callGoogle(joined, target)).split("\n");
        if (translated.length === idx.length) {
          idx.forEach((i, k) => {
            out[i] = translated[k].trim();
            cache.set(`${target}|${texts[i]}`, out[i]);
          });
          return;
        }
        // Line count changed: translate one by one instead.
        await Promise.all(
          idx.map(async (i) => {
            out[i] = (await callGoogle(texts[i], target)).trim();
            cache.set(`${target}|${texts[i]}`, out[i]);
          })
        );
      } catch {
        // keep originals
      }
    })
  );
  if (cache.size > 20000) cache.clear();
  return out;
}
