import { getScores } from "@/lib/scores";

/** Match results for the Sports page ticker; the browser polls this every 30 seconds. */
export const dynamic = "force-dynamic";

export async function GET() {
  const { matches, live } = await getScores();
  return Response.json({ matches, live }, { headers: { "Cache-Control": `public, max-age=${live ? 15 : 120}` } });
}
