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

export async function fetchLeadText(url: string, userAgent: string): Promise<string | null> {
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
