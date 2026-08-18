// Seed data used the first time company tracking runs (see lib/seed.ts).
// After that, companies live in the database and can be edited from the
// sidebar without a redeploy.
//
// ticker/cik were verified against SEC's public company_tickers.json and
// web search, not recalled from memory — a wrong CIK would silently pull
// another company's filings. Five of the 24 requested companies are not
// SEC EDGAR filers (cik: null): Bayer, Merck KGaA, Roche and UCB trade
// only as OTC ADRs abroad and don't register with the SEC, so they get a
// ticker (for the Yahoo stock quote) but no SEC filing ingestion.
// Boehringer Ingelheim is privately held — no ticker and no CIK, so it has
// no stock price and no SEC filings; it will only ever show FDA-sourced
// updates (openFDA looks up by sponsor name, not by ticker/CIK).

export interface CompanySeed {
  name: string;
  ticker: string | null;
  cik: string | null; // 10-digit zero-padded SEC CIK, or null if not an SEC filer
  // Name(s) openFDA's sponsor_name field tends to use for this company —
  // openFDA has no company/CIK concept, only free-text sponsor strings, so
  // matching is inherently best-effort.
  fdaSponsorNames: string[];
}

function cik(n: number): string {
  return String(n).padStart(10, "0");
}

export const DEFAULT_COMPANIES: CompanySeed[] = [
  { name: "AbbVie", ticker: "ABBV", cik: cik(1551152), fdaSponsorNames: ["AbbVie"] },
  { name: "Amgen", ticker: "AMGN", cik: cik(318154), fdaSponsorNames: ["Amgen"] },
  { name: "AstraZeneca", ticker: "AZN", cik: cik(901832), fdaSponsorNames: ["AstraZeneca"] },
  { name: "Bayer", ticker: "BAYRY", cik: null, fdaSponsorNames: ["Bayer"] },
  { name: "Biogen", ticker: "BIIB", cik: cik(875045), fdaSponsorNames: ["Biogen"] },
  { name: "Boehringer Ingelheim", ticker: null, cik: null, fdaSponsorNames: ["Boehringer Ingelheim"] },
  { name: "Bristol Myers Squibb", ticker: "BMY", cik: cik(14272), fdaSponsorNames: ["Bristol Myers Squibb", "Bristol-Myers Squibb"] },
  { name: "Gilead", ticker: "GILD", cik: cik(882095), fdaSponsorNames: ["Gilead"] },
  { name: "Johnson & Johnson (Janssen)", ticker: "JNJ", cik: cik(200406), fdaSponsorNames: ["Janssen", "Johnson & Johnson", "Johnson and Johnson"] },
  { name: "GSK", ticker: "GSK", cik: cik(1131399), fdaSponsorNames: ["GlaxoSmithKline", "GSK"] },
  { name: "Incyte", ticker: "INCY", cik: cik(879169), fdaSponsorNames: ["Incyte"] },
  { name: "Lilly", ticker: "LLY", cik: cik(59478), fdaSponsorNames: ["Eli Lilly", "Lilly"] },
  { name: "Merck", ticker: "MRK", cik: cik(310158), fdaSponsorNames: ["Merck Sharp", "Merck & Co"] },
  { name: "Merck KGaA", ticker: "MKKGY", cik: null, fdaSponsorNames: ["Merck KGaA", "EMD Serono"] },
  { name: "Novartis", ticker: "NVS", cik: cik(1114448), fdaSponsorNames: ["Novartis"] },
  { name: "Novo Nordisk", ticker: "NVO", cik: cik(353278), fdaSponsorNames: ["Novo Nordisk"] },
  { name: "Pfizer", ticker: "PFE", cik: cik(78003), fdaSponsorNames: ["Pfizer"] },
  { name: "Regeneron", ticker: "REGN", cik: cik(872589), fdaSponsorNames: ["Regeneron"] },
  { name: "Roche", ticker: "RHHBY", cik: null, fdaSponsorNames: ["Roche", "Genentech"] },
  { name: "Sanofi", ticker: "SNY", cik: cik(1121404), fdaSponsorNames: ["Sanofi"] },
  { name: "Takeda", ticker: "TAK", cik: cik(1395064), fdaSponsorNames: ["Takeda"] },
  { name: "Teva", ticker: "TEVA", cik: cik(818686), fdaSponsorNames: ["Teva"] },
  { name: "UCB", ticker: "UCBJY", cik: null, fdaSponsorNames: ["UCB"] },
  { name: "Vertex", ticker: "VRTX", cik: cik(875320), fdaSponsorNames: ["Vertex Pharmaceuticals", "Vertex"] },
];
