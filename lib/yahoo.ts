// Thin, keyless client for Yahoo Finance's unofficial public APIs. No API
// key or account needed, but also no formal SLA — Yahoo can rate-limit,
// require auth, or change these endpoints without notice. Used only for a
// lightweight snapshot in the company detail pane's header, fetched on
// demand (not stored), so a transient failure just means the header omits
// that data rather than breaking anything persisted.
//
// Two distinct unofficial endpoints are combined here:
// - v8/finance/chart: price + historical closes (used for the 52-week
//   average and the sparkline). This one is reliably keyless.
// - v10/finance/quoteSummary: fundamentals (market cap, earnings date, net
//   income, profit margin, total cash). Yahoo has tightened access to this
//   one over time and it can start requiring a "crumb"/cookie or simply
//   403 from a datacenter IP — every field below degrades to null rather
//   than failing the whole quote if that happens.

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
  // Weekly closes over the trailing year, oldest first — for a small trend
  // sparkline next to the price. Same series the 52-week average is
  // computed from.
  sparkline: number[];
  marketCap: number | null; // intraday
  nextEarningsDate: string | null; // ISO date, best-effort
  netIncome: number | null; // trailing twelve months
  profitMargin: number | null; // ratio, e.g. 0.2983 for 29.83%
  totalCash: number | null; // most recent quarter
  asOf: string; // ISO timestamp this snapshot was fetched
}

interface ChartSnapshot {
  price: number | null;
  currency: string | null;
  closes: number[];
}

async function fetchChartSnapshot(ticker: string): Promise<ChartSnapshot | null> {
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

  return {
    price: typeof result.meta?.regularMarketPrice === "number" ? result.meta.regularMarketPrice : null,
    currency: result.meta?.currency ?? null,
    closes: validCloses,
  };
}

interface Fundamentals {
  marketCap: number | null;
  nextEarningsDate: string | null;
  netIncome: number | null;
  profitMargin: number | null;
  totalCash: number | null;
}

function rawOf(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (v as any)?.raw;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

async function fetchFundamentals(ticker: string): Promise<Fundamentals | null> {
  const modules = "price,summaryDetail,defaultKeyStatistics,financialData,calendarEvents";
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClinicalTrialsDashboard/1.0)",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (data as any)?.quoteSummary?.result?.[0];
    if (!result) return null;

    const marketCap = rawOf(result.price?.marketCap) ?? rawOf(result.summaryDetail?.marketCap);
    const netIncome = rawOf(result.defaultKeyStatistics?.netIncomeToCommon) ?? rawOf(result.financialData?.netIncomeToCommon);
    const profitMargin = rawOf(result.financialData?.profitMargins);
    const totalCash = rawOf(result.financialData?.totalCash);

    const earningsRaw = result.calendarEvents?.earnings?.earningsDate?.[0]?.raw;
    const nextEarningsDate =
      typeof earningsRaw === "number" ? new Date(earningsRaw * 1000).toISOString() : null;

    return { marketCap, nextEarningsDate, netIncome, profitMargin, totalCash };
  } catch {
    return null;
  }
}

export async function fetchStockQuote(ticker: string): Promise<StockQuote | null> {
  const [chart, fundamentals] = await Promise.all([fetchChartSnapshot(ticker), fetchFundamentals(ticker)]);
  if (!chart) return null;

  const closes = chart.closes;
  const average = closes.length > 0 ? closes.reduce((sum, c) => sum + c, 0) / closes.length : null;

  return {
    ticker,
    price: chart.price,
    currency: chart.currency,
    fiftyTwoWeekAverage: average,
    fiftyTwoWeekHigh: closes.length ? Math.max(...closes) : null,
    fiftyTwoWeekLow: closes.length ? Math.min(...closes) : null,
    sparkline: closes,
    marketCap: fundamentals?.marketCap ?? null,
    nextEarningsDate: fundamentals?.nextEarningsDate ?? null,
    netIncome: fundamentals?.netIncome ?? null,
    profitMargin: fundamentals?.profitMargin ?? null,
    totalCash: fundamentals?.totalCash ?? null,
    asOf: new Date().toISOString(),
  };
}
