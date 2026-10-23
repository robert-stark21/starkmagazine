import type { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SLOW_IMAGE_HOSTS } from "@/lib/img";

/**
 * Image relay for a few slow image servers (see SLOW_IMAGE_HOSTS). They answer browsers
 * only a couple of files at a time, so galleries stay empty. We fetch each file once,
 * two at a time per host, keep it on disk and serve it with a long cache lifetime.
 * Only the listed hosts are allowed, so this can't be used to fetch other sites.
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36";
const DIR = path.join(process.env.VERCEL ? "/tmp" : path.join(process.cwd(), ".cache"), "img");
const MAX_BYTES = 15 * 1024 * 1024;
const PER_HOST = 2;

export const dynamic = "force-dynamic";

const running = new Map<string, number>();
const waiting = new Map<string, (() => void)[]>();

/** Runs fn with at most PER_HOST requests in flight to the same host. */
async function limited<T>(host: string, fn: () => Promise<T>): Promise<T> {
  if ((running.get(host) ?? 0) >= PER_HOST) {
    await new Promise<void>((go) => waiting.set(host, [...(waiting.get(host) ?? []), go]));
  }
  running.set(host, (running.get(host) ?? 0) + 1);
  try {
    return await fn();
  } finally {
    running.set(host, (running.get(host) ?? 1) - 1);
    waiting.get(host)?.shift()?.();
  }
}

const headers = (type: string) => ({ "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" });

export async function GET(req: NextRequest) {
  let target: URL;
  try {
    target = new URL(req.nextUrl.searchParams.get("u") ?? "");
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !SLOW_IMAGE_HOSTS.has(target.hostname)) {
    return new Response("host not allowed", { status: 403 });
  }

  const key = createHash("sha1").update(target.href).digest("hex");
  const file = path.join(DIR, key);
  try {
    const [type, body] = await Promise.all([fs.promises.readFile(`${file}.type`, "utf8"), fs.promises.readFile(file)]);
    return new Response(body, { headers: headers(type) });
  } catch {}

  const res = await limited(target.hostname, () =>
    fetch(target, { headers: { "User-Agent": UA, Accept: "image/*" }, cache: "no-store", signal: AbortSignal.timeout(30000) }).catch(() => null)
  );
  const type = res?.headers.get("content-type") ?? "";
  if (!res?.ok || !type.startsWith("image/")) return new Response("upstream error", { status: res?.status || 502 });
  const body = Buffer.from(await res.arrayBuffer());
  if (body.byteLength > MAX_BYTES) return new Response("too large", { status: 413 });

  fs.promises
    .mkdir(DIR, { recursive: true })
    .then(() => Promise.all([fs.promises.writeFile(file, body), fs.promises.writeFile(`${file}.type`, type)]))
    .catch(() => {});
  return new Response(body, { headers: headers(type) });
}
