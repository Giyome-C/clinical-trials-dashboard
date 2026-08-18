// Thin, keyless client for Yahoo Finance's unofficial public chart API.
// No API key or account needed, but also no formal SLA — Yahoo can
// rate-limit or change this endpoint without notice. Used only for a
// lightweight price snapshot in the company detail pane's header, fetched
// on demand (not stored), so a transient failure just means the header
// omits the price rather than breaking anything persisted.

export interface StockQuote {
  ticker: string;
  price: number | null;
  currency: string | null;
  // Mean of weekly closing prices over the trailing year — a genuine
  // 52-week (moving) average, not to be confused with the 52-week
  // high/low range also included below for context.
  fiftyTwoWeekAverage: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  asOf: string; // ISO timestamp this snapshot was fetched
}

export async function fetchStockQuote(ticker: string): Promise<StockQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1wk`;

  let data: unknown;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClinicalTrialsDashboard/1.0)",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    data = await res.json();
  } catch {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (data as any)?.chart?.result?.[0];
  if (!result) return null;

  const closes: unknown[] = result.indicators?.quote?.[0]?.close ?? [];
  const validCloses = closes.filter((c): c is number => typeof c === "number" && Number.isFinite(c));
  const average =
    validCloses.length > 0 ? validCloses.reduce((sum, c) => sum + c, 0) / validCloses.length : null;

  return {
    ticker,
    price: typeof result.meta?.regularMarketPrice === "number" ? result.meta.regularMarketPrice : null,
    currency: result.meta?.currency ?? null,
    fiftyTwoWeekAverage: average,
    fiftyTwoWeekHigh: validCloses.length ? Math.max(...validCloses) : null,
    fiftyTwoWeekLow: validCloses.length ? Math.min(...validCloses) : null,
    asOf: new Date().toISOString(),
  };
}
