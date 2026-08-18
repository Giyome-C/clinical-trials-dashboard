// Thin client for SEC EDGAR's public submissions API
// (https://www.sec.gov/edgar/sec-api-documentation). No API key required,
// but SEC requires every automated requester to send a descriptive
// User-Agent identifying who's calling (https://www.sec.gov/os/webmaster-faq#developers).
// Set SEC_EDGAR_CONTACT_EMAIL in your environment to a real contact — the
// fallback below works, but using your own email is the polite/compliant
// default SEC asks for.

const EDGAR_CONTACT = process.env.SEC_EDGAR_CONTACT_EMAIL || "contact@example.com";
const USER_AGENT = `Clinical Trials Dashboard (${EDGAR_CONTACT})`;

// Exported so other SEC-facing fetches (e.g. lib/lead-text.ts, which pulls
// the actual filing document for a press-release summary) send the same
// compliant identification instead of an unset default fetch User-Agent.
export const EDGAR_USER_AGENT = USER_AGENT;

export interface EdgarFiling {
  accessionNumber: string;
  filingDate: string; // "YYYY-MM-DD"
  reportDate: string | null;
  form: string; // "10-K", "10-Q", "8-K", "S-1", ...
  primaryDocument: string;
  primaryDocDescription: string | null;
  items: string | null; // e.g. "2.02,9.01" for 8-Ks, comma-separated
}

interface SubmissionsResponse {
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      form?: string[];
      primaryDocument?: string[];
      primaryDocDescription?: string[];
      items?: string[];
    };
  };
}

// Builds the public filing document URL for a given accession number.
export function edgarFilingUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
  const cikNum = String(Number(cik)); // strip leading zeros for the Archives path
  const accNoDashes = accessionNumber.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDashes}/${primaryDocument || ""}`;
}

// Fetches the most recent filings for a company, newest first. SEC's
// "recent" block typically covers roughly the last year, far more than any
// single refresh needs — trimmed to maxResults.
export async function fetchRecentFilings(cik: string, maxResults = 40): Promise<EdgarFiling[]> {
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) return []; // no submissions on file for this CIK
    const text = await res.text().catch(() => "");
    throw new Error(`SEC EDGAR returned ${res.status} for CIK ${cik}: ${text.slice(0, 300)}`);
  }

  const data: SubmissionsResponse = await res.json();
  const recent = data.filings?.recent;
  if (!recent?.accessionNumber) return [];

  const count = recent.accessionNumber.length;
  const filings: EdgarFiling[] = [];
  for (let i = 0; i < count && filings.length < maxResults; i++) {
    filings.push({
      accessionNumber: recent.accessionNumber[i],
      filingDate: recent.filingDate?.[i] ?? "",
      reportDate: recent.reportDate?.[i] || null,
      form: recent.form?.[i] ?? "",
      primaryDocument: recent.primaryDocument?.[i] || "",
      primaryDocDescription: recent.primaryDocDescription?.[i] || null,
      items: recent.items?.[i] || null,
    });
  }
  return filings;
}

// Forms worth surfacing as "SEC filing" updates. Deliberately excludes
// routine ownership forms (3/4/5), which would otherwise flood the feed
// with low-signal insider-trading paperwork.
export const TRACKED_FORMS = new Set([
  "10-K", "10-K/A",
  "10-Q", "10-Q/A",
  "8-K", "8-K/A",
  "6-K", "6-K/A",
  "20-F", "20-F/A",
  "S-1", "S-1/A",
  "S-3", "S-3/A",
  "DEF 14A",
]);

// 8-K "Item" numbers that typically carry earnings releases or other
// newsworthy disclosures with a press-release exhibit attached — used to
// approximate "press releases" from free SEC data instead of a paid
// newswire feed. See lib/company-refresh.ts for how this is applied.
export const PRESS_RELEASE_ITEMS = new Set(["2.02", "7.01", "8.01"]);
