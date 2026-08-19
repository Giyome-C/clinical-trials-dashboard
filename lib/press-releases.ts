// Best-effort scraper for official company press-release/newsroom pages —
// this is what makes "press release" updates real content from the
// company's own site, instead of the SEC 8-K item 2.02/7.01/9.01 proxy
// lib/company-refresh.ts falls back to for everyone else (see that file).
//
// COVERAGE: only 11 of the 24 tracked companies are listed in
// PRESS_RELEASE_SOURCES below. Every one of the 24 requested sites was
// checked by hand before building this. The rest fall into three buckets
// a plain server-side fetch fundamentally can't handle without a much
// heavier dependency (a real, JavaScript-executing browser) or extra
// research time:
//   - Renders its release list client-side via JavaScript, so a plain
//     fetch only ever sees an empty shell: AstraZeneca, GSK, Roche,
//     Takeda, Novo Nordisk, Amgen, Gilead, Merck KGaA.
//   - Sits behind bot-detection that blocks a plain fetch outright:
//     Boehringer Ingelheim (Incapsula challenge page).
//   - Couldn't be pinned to a stable, working listing URL in the time
//     available: Bristol Myers Squibb, Regeneron, UCB, Teva.
// Those 13 companies keep using the SEC-filing proxy, same as before this
// feature — see lib/company-refresh.ts's collectForCompany.
//
// EXTRACTION METHOD: rather than a hand-coded CSS selector per site (which
// would require verifying each site's real markup — not possible from
// this environment, and fragile even if it were), this uses a generic,
// structure-agnostic heuristic: scan every link on the page, keep the ones
// that look like article links (same-origin, a long hyphenated path — not
// a nav/utility route — with substantial visible text). Expect some noise
// and some misses; expect it to need retuning if a covered site redesigns
// its markup.
//
// Deliberately does NOT try to read a publish date off this listing page:
// an earlier version guessed a date from text near each link, and on at
// least one real site that guess wasn't scoped to the right row — it read
// the newest item's date and applied it to several older ones too. The
// real date is read from each article's own page instead, in
// lib/lead-text.ts's fetchArticleDetails (structured metadata scoped to
// that one article, not a proximity guess).

import * as cheerio from "cheerio";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Exported so lib/company-refresh.ts can send the same header when it
// fetches an individual press release's own page for a lead-text summary.
export const PRESS_RELEASE_USER_AGENT = BROWSER_USER_AGENT;

export interface PressReleaseSource {
  url: string;
}

// Keyed by the exact Company.name values in lib/companies.ts.
export const PRESS_RELEASE_SOURCES: Record<string, PressReleaseSource> = {
  AbbVie: { url: "https://news.abbvie.com/" },
  Pfizer: { url: "https://www.pfizer.com/news" },
  Novartis: { url: "https://www.novartis.com/news" },
  "Johnson & Johnson (Janssen)": { url: "https://www.jnj.com/media-center/press-releases" },
  Vertex: { url: "https://news.vrtx.com/press-releases" },
  Sanofi: { url: "https://www.sanofi.com/en/media-room/press-releases" },
  Merck: { url: "https://www.merck.com/media/news/" },
  Incyte: { url: "https://investor.incyte.com/press-releases" },
  // investor.lilly.com/news-releases 404s (site restructured); the IR
  // homepage itself carries the same recent-release links in static HTML.
  Lilly: { url: "https://investor.lilly.com/" },
  // investors.biogen.com/news-releases 404s; the real listing page moved
  // under /news/news-releases.
  Biogen: { url: "https://investors.biogen.com/news/news-releases" },
  Bayer: { url: "https://www.bayer.com/en/media" },
};

export interface ScrapedPressRelease {
  title: string;
  url: string;
}

// Path segments that are almost never a press-release article — filters
// out nav/footer/utility links before they're treated as candidates.
const SKIP_PATH_PATTERN =
  /\/(about|contact(-us)?|careers|jobs|privacy|cookies?|terms|legal|sitemap|login|search|subscribe|rss|accessibility|investors?|media-center|media|news|press-releases?|news-releases?)\/?$/i;

// Real pharma press-release headlines routinely run 200-300 characters
// (e.g. "Merck and Moderna Announce Phase 3 INTerpath-001 Trial of
// Intismeran Autogene Plus KEYTRUDA® Met Endpoints of Recurrence-Free
// Survival (RFS) and Distant Metastasis-Free Survival (DMFS) in Patients
// With Completely Resected Stage IIB-IV Melanoma" is 245) — a first
// version of this cap sat at 220 and silently dropped headlines like that
// one entirely. Kept high rather than removed so an accidental full
// paragraph (concatenated multi-line link text) still gets excluded.
const MIN_TITLE_LENGTH = 20;
const MAX_TITLE_LENGTH = 320;

// Deliberately does NOT swallow fetch failures into an empty array — an
// earlier version did, and it meant a blocked/failed fetch and a "reached
// the site but found nothing" were indistinguishable from the caller's
// side, and neither ever showed up in CompanyRefreshLog.errorMessage. Let
// this throw; lib/company-refresh.ts's catch records the real reason.
export async function fetchPressReleaseList(sourceUrl: string, maxItems = 12): Promise<ScrapedPressRelease[]> {
  const res = await fetch(sourceUrl, {
    headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`fetch returned ${res.status} ${res.statusText} for ${sourceUrl}`);
  }
  const html = await res.text();

  const $ = cheerio.load(html);
  const origin = new URL(sourceUrl).origin;
  const seen = new Set<string>();
  const items: ScrapedPressRelease[] = [];

  $("a[href]").each((_, el) => {
    if (items.length >= maxItems) return;
    const href = $(el).attr("href");
    if (!href) return;

    let absolute: URL;
    try {
      absolute = new URL(href, sourceUrl);
    } catch {
      return;
    }
    if (absolute.origin !== origin) return;
    if (SKIP_PATH_PATTERN.test(absolute.pathname)) return;

    // Article slugs on these sites are typically several hyphenated words
    // deep — the main signal that separates a headline link from a nav
    // link, which usually has a short, plain path segment.
    const segments = absolute.pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? "";
    if (lastSegment.split("-").length < 4) return;

    const title = $(el).text().replace(/\s+/g, " ").trim();
    if (title.length < MIN_TITLE_LENGTH || title.length > MAX_TITLE_LENGTH) return;

    const key = absolute.origin + absolute.pathname;
    if (seen.has(key)) return;
    seen.add(key);

    items.push({ title, url: absolute.toString() });
  });

  return items.slice(0, maxItems);
}
