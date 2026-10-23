import type { NextRequest } from "next/server";

/**
 * Video proxy for VnExpress. Its video CDN only serves requests that come from vnexpress.net,
 * so we fetch playlists and segments with that referer and pass them through.
 * Only VnExpress video hosts are allowed, so this can't be used to fetch other sites.
 */
const ALLOWED = /(^|\.)vnecdn\.net$/i;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36";

export const dynamic = "force-dynamic";

const proxied = (u: string) => `/api/video?u=${encodeURIComponent(u)}`;

/** Points every URL inside an HLS playlist back at this proxy. */
function rewritePlaylist(text: string, base: string): string {
  const abs = (u: string) => {
    try {
      return proxied(new URL(u.trim(), base).href);
    } catch {
      return u;
    }
  };
  return text
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("#")) return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${abs(u)}"`);
      return abs(t);
    })
    .join("\n");
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED.test(target.hostname)) {
    return new Response("host not allowed", { status: 403 });
  }

  const headers: Record<string, string> = { "User-Agent": UA, Referer: "https://vnexpress.net/", Origin: "https://vnexpress.net" };
  const range = req.headers.get("range");
  if (range) headers.Range = range;

  const upstream = await fetch(target, { headers, cache: "no-store", signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!upstream || (!upstream.ok && upstream.status !== 206)) {
    return new Response("upstream error", { status: upstream?.status ?? 502 });
  }

  const type = upstream.headers.get("content-type") ?? "";
  if (/mpegurl/i.test(type) || target.pathname.endsWith(".m3u8")) {
    const body = rewritePlaylist(await upstream.text(), target.href);
    return new Response(body, {
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "public, max-age=60" },
    });
  }

  // Segments and other media: stream straight through.
  const out = new Headers({ "Cache-Control": "public, max-age=86400" });
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
