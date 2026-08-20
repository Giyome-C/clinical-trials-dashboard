// Renders a page in a real headless Chrome browser via Browserless.io's
// REST API, for the handful of tracked-company sites where a plain
// server-side fetch (lib/press-releases.ts's default path) doesn't work:
// either because the page's content is injected client-side by JavaScript,
// or because the site's bot-detection serves a stripped/cloaked response to
// a bare fetch while still returning HTTP 200 (this is what was actually
// happening for Biogen — see the renderMode note on its entry in
// lib/press-releases.ts).
//
// Opt-in per source, not the default: rendering a page in a real browser
// costs Browserless "units" (their metered resource), so it's only used for
// sources that need it — most of the 24 tracked companies' sites work fine
// with a plain fetch and stay on that free path.
//
// Requires BROWSERLESS_API_KEY (set it in Vercel's project environment
// variables). Browserless's free tier is 1,000 units/month, and one render
// is one unit — this app's usage (a handful of sources, refreshed on
// demand) stays well inside that. Sign up at https://www.browserless.io and
// grab an API key from their dashboard; BROWSERLESS_ENDPOINT can override
// the default region if a different one is preferred.
//
// Deliberately does NOT swallow failures — same reasoning as
// lib/press-releases.ts's fetchPressReleaseList: a missing API key or a
// failed render should show up in CompanyRefreshLog.errorMessage, not
// silently produce zero updates.

const DEFAULT_ENDPOINT = "https://production-sfo.browserless.io/content";

export async function fetchRenderedHtml(url: string): Promise<string> {
  const apiKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey) {
    throw new Error(
      `BROWSERLESS_API_KEY is not set — required to render ${url} in a real browser. Add it in Vercel's project environment variables (see lib/browserless.ts).`
    );
  }
  const endpoint = process.env.BROWSERLESS_ENDPOINT ?? DEFAULT_ENDPOINT;

  const res = await fetch(`${endpoint}?token=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Browserless render returned ${res.status} ${res.statusText} for ${url}${body ? `: ${body.slice(0, 300)}` : ""}`
    );
  }
  return res.text();
}
