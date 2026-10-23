/**
 * Prices for the header price ticker: crypto from CoinGecko (Binance as a fallback), gold and
 * silver spot from gold-api.com, and the USDT/VND rate. No API keys. Kept in memory for
 * 60 seconds; when stale, the old data is served at once and refreshed in the background.
 */
export type Quote = { sym: string; name: string; price: number; change?: number; cur: "USD" | "VND" };

const COINS: { id: string; sym: string; name: string; binance: string }[] = [
  { id: "bitcoin", sym: "BTC", name: "Bitcoin", binance: "BTCUSDT" },
  { id: "ethereum", sym: "ETH", name: "Ethereum", binance: "ETHUSDT" },
  { id: "solana", sym: "SOL", name: "Solana", binance: "SOLUSDT" },
  { id: "binancecoin", sym: "BNB", name: "BNB", binance: "BNBUSDT" },
  { id: "ripple", sym: "XRP", name: "XRP", binance: "XRPUSDT" },
  { id: "dogecoin", sym: "DOGE", name: "Dogecoin", binance: "DOGEUSDT" },
  { id: "cardano", sym: "ADA", name: "Cardano", binance: "ADAUSDT" },
  { id: "the-open-network", sym: "TON", name: "Toncoin", binance: "TONUSDT" },
];
const TTL = 60_000;
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" };

let memo: { at: number; quotes: Quote[] } | null = null;
let inflight: Promise<Quote[]> | null = null;

const getJson = async (url: string) => {
  const r = await fetch(url, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

async function crypto(): Promise<{ quotes: Quote[]; vnd?: Quote }> {
  try {
    const ids = [...COINS.map((c) => c.id), "tether"].join(",");
    const d = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,vnd&include_24hr_change=true`);
    const quotes = COINS.filter((c) => d[c.id]?.usd).map((c) => ({ sym: c.sym, name: c.name, price: d[c.id].usd, change: d[c.id].usd_24h_change, cur: "USD" as const }));
    const vnd = d.tether?.vnd ? { sym: "USDT/VND", name: "Tether", price: d.tether.vnd, change: d.tether.vnd_24h_change, cur: "VND" as const } : undefined;
    if (quotes.length) return { quotes, vnd };
  } catch {}
  // Fallback: Binance 24h tickers (USDT pairs).
  const symbols = encodeURIComponent(JSON.stringify(COINS.map((c) => c.binance)));
  const rows: { symbol: string; lastPrice: string; priceChangePercent: string }[] = await getJson(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`);
  const by = new Map(rows.map((r) => [r.symbol, r]));
  return {
    quotes: COINS.filter((c) => by.has(c.binance)).map((c) => ({ sym: c.sym, name: c.name, price: +by.get(c.binance)!.lastPrice, change: +by.get(c.binance)!.priceChangePercent, cur: "USD" as const })),
  };
}

async function metal(sym: "XAU" | "XAG", name: string): Promise<Quote | undefined> {
  try {
    const d = await getJson(`https://api.gold-api.com/price/${sym}`);
    return d?.price ? { sym, name, price: d.price, cur: "USD" } : undefined;
  } catch {
    return undefined;
  }
}

async function load(): Promise<Quote[]> {
  const [c, gold, silver] = await Promise.all([crypto().catch(() => ({ quotes: [] as Quote[] })), metal("XAU", "Gold"), metal("XAG", "Silver")]);
  const [btc, eth, ...alts] = c.quotes;
  // BTC, ETH, gold first, then the altcoins, silver and the dollar rate.
  const quotes = [btc, eth, gold, ...alts, silver, (c as { vnd?: Quote }).vnd].filter(Boolean) as Quote[];
  if (quotes.length) memo = { at: Date.now(), quotes };
  return memo?.quotes ?? [];
}

/**
 * Current quotes. Serves cached data at once and refreshes it in the background when it is
 * older than a minute. With nothing cached yet, waits at most maxWaitMs for the first load.
 */
export async function getQuotes(maxWaitMs = 8000): Promise<Quote[]> {
  const fresh = memo && Date.now() - memo.at < TTL;
  if (!fresh && !inflight) inflight = load().finally(() => (inflight = null));
  if (memo) return memo.quotes;
  return Promise.race([inflight!, new Promise<Quote[]>((r) => setTimeout(() => r([]), maxWaitMs))]);
}
