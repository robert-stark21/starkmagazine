import { getQuotes } from "@/lib/prices";

/** Prices for the header ticker; the browser polls this once a minute. */
export const dynamic = "force-dynamic";

export async function GET() {
  const quotes = await getQuotes();
  return Response.json({ quotes }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
}
