// Thin client for the public openFDA API (https://open.fda.gov). No API
// key required (unauthenticated requests are rate-limited but sufficient
// for a once-a-day refresh). openFDA has no company/CIK concept — matching
// is by free-text sponsor/manufacturer name, so results are inherently
// best-effort (see lib/companies.ts's fdaSponsorNames comment).

const OPENFDA_BASE = "https://api.fda.gov/drug";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function openFdaSearch(path: string, searchExpr: string, limit = 100): Promise<any[]> {
  const url = new URL(`${OPENFDA_BASE}/${path}.json`);
  url.searchParams.set("search", searchExpr);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    // openFDA returns 404 (not 200-with-empty-array) when a search matches
    // nothing at all — treat that as "no results" rather than an error.
    if (res.status === 404) return [];
    const text = await res.text().catch(() => "");
    throw new Error(`openFDA /${path} returned ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.results ?? [];
}

function parseFdaDate(yyyymmdd: string | undefined | null): string | null {
  if (!yyyymmdd || yyyymmdd.length !== 8) return null;
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  const iso = `${y}-${m}-${d}T00:00:00.000Z`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

export interface FdaUpdate {
  externalId: string;
  title: string;
  summary: string | null;
  sourceDate: string; // ISO
  url: string;
}

// Recent approvals/supplements for a sponsor, sourced from Drugs@FDA via
// openFDA's drugsfda endpoint. Each application can carry a long submission
// history; only each application's newest few submissions are kept, since
// older ones will already have been captured (or predate tracking).
export async function fetchDrugApprovals(sponsorNames: string[]): Promise<FdaUpdate[]> {
  const seen = new Map<string, FdaUpdate>();

  for (const name of sponsorNames) {
    const results = await openFdaSearch("drugsfda", `sponsor_name:"${name}"`).catch(() => []);
    for (const app of results) {
      const appNo: string | undefined = app.application_number;
      if (!appNo) continue;
      const brand = app.products?.[0]?.brand_name || app.openfda?.brand_name?.[0];
      const generic = (app.products?.[0]?.active_ingredients ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((i: any) => i.name)
        .filter(Boolean)
        .join("/");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const submissions: any[] = app.submissions ?? [];
      const approved = submissions
        .filter((s) => s.submission_status === "AP")
        .sort((a, b) => String(b.submission_status_date ?? "").localeCompare(String(a.submission_status_date ?? "")))
        .slice(0, 3);

      for (const sub of approved) {
        if (!sub.submission_number) continue;
        const sourceDate = parseFdaDate(sub.submission_status_date);
        if (!sourceDate) continue;
        const externalId = `${appNo}-${sub.submission_type}-${sub.submission_number}`;
        const isOriginal = sub.submission_type === "ORIG";
        seen.set(externalId, {
          externalId,
          title: `FDA ${isOriginal ? "approval" : "supplement approval"}: ${brand || generic || appNo}`,
          summary:
            [generic ? `Active ingredient: ${generic}` : null, sub.review_priority ? `Review: ${sub.review_priority}` : null]
              .filter(Boolean)
              .join(" · ") || null,
          sourceDate,
          url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appNo.replace(/^\D+/, "")}`,
        });
      }
    }
  }

  return Array.from(seen.values());
}

// Recent label revisions for a sponsor's products, sourced from openFDA's
// drug label endpoint (Structured Product Labeling data).
export async function fetchDrugLabelUpdates(sponsorNames: string[]): Promise<FdaUpdate[]> {
  const seen = new Map<string, FdaUpdate>();

  for (const name of sponsorNames) {
    const results = await openFdaSearch("label", `openfda.manufacturer_name:"${name}"`).catch(() => []);
    for (const label of results) {
      const setId: string | undefined = label.set_id ?? label.id;
      if (!setId) continue;
      const sourceDate = parseFdaDate(label.effective_time);
      if (!sourceDate) continue;
      const brand = label.openfda?.brand_name?.[0] || label.openfda?.generic_name?.[0];
      const indications: string | undefined = label.indications_and_usage?.[0];
      seen.set(setId, {
        externalId: setId,
        title: `FDA label update: ${brand || "unnamed product"}`,
        summary: indications ? indications.slice(0, 240) : null,
        sourceDate,
        url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}`,
      });
    }
  }

  return Array.from(seen.values());
}
