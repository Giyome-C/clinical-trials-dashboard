// Free, deterministic stand-in for a real summary: fetches a source
// document (an SEC filing exhibit, in practice) and pulls out its opening
// paragraph(s) as plain text. This is extraction, not synthesis — it
// doesn't paraphrase or condense, it just surfaces the actual lead text of
// the document so a reader gets real content instead of a bare title.
//
// Best-effort by nature: SEC exhibit documents vary widely in structure
// (a plain press release, a cover page, an XBRL-tagged wrapper), so this
// can't guarantee it always lands on the most meaningful paragraph — it's
// "good enough excerpt," not a guaranteed abstract.

const MAX_FETCH_CHARS = 500_000; // cap how much of a document we read
const LEAD_TEXT_MAX_CHARS = 700;

function stripHtml(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  // Turn common block-level boundaries into newlines before stripping tags,
  // so paragraphs don't get glued together into one giant line.
  text = text.replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

async function fetchRawPage(url: string, userAgent: string): Promise<{ raw: string; looksLikeHtml: boolean } | null> {
  let raw: string;
  let contentType = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml,text/plain" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    contentType = res.headers.get("content-type") ?? "";
    raw = (await res.text()).slice(0, MAX_FETCH_CHARS);
  } catch {
    return null;
  }
  const looksLikeHtml = contentType.includes("html") || /<html/i.test(raw.slice(0, 500));
  return { raw, looksLikeHtml };
}

function extractLeadText(raw: string, looksLikeHtml: boolean): string | null {
  const text = looksLikeHtml ? stripHtml(raw) : raw;

  const paragraphs = text
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 40);
  if (paragraphs.length === 0) return null;

  // Skip boilerplate cover-page lines (form captions, all-caps headers)
  // and start from the first paragraph that reads like actual prose.
  const startIdx = paragraphs.findIndex((p) => /[a-z]/.test(p));
  const lead = paragraphs.slice(startIdx >= 0 ? startIdx : 0, (startIdx >= 0 ? startIdx : 0) + 2).join(" ");

  return truncateAtWord(lead, LEAD_TEXT_MAX_CHARS);
}

// Looks for a structured publish date in the page's own markup — a
// <meta property="article:published_time">, a JSON-LD "datePublished", or
// a <time datetime="..."> — which is how almost every modern news/CMS page
// marks up its date. This reads the date straight off the specific
// article's own page, which is far more reliable than trying to guess a
// date from text sitting near a link on a *listing* page: that approach
// (an earlier version of the site-scraper) let the wrong row's date bleed
// into a different article whenever the surrounding markup didn't nest
// the way the guess assumed.
function extractPublishedDate(raw: string): Date | null {
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']date["']/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) {
      const d = new Date(match[1]);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

export async function fetchLeadText(url: string, userAgent: string): Promise<string | null> {
  const page = await fetchRawPage(url, userAgent);
  if (!page) return null;
  return extractLeadText(page.raw, page.looksLikeHtml);
}

// Single fetch, both extractions — used for site-scraped press releases
// (lib/press-releases.ts via lib/company-refresh.ts) so each article isn't
// fetched twice just to get its summary and its date separately.
export async function fetchArticleDetails(
  url: string,
  userAgent: string
): Promise<{ leadText: string | null; publishedAt: Date | null }> {
  const page = await fetchRawPage(url, userAgent);
  if (!page) return { leadText: null, publishedAt: null };
  return {
    leadText: extractLeadText(page.raw, page.looksLikeHtml),
    publishedAt: page.looksLikeHtml ? extractPublishedDate(page.raw) : null,
  };
}
