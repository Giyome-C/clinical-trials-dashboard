import { prisma } from "./db";
import { ensureCompaniesSeeded } from "./seed";
import { fetchRecentFilings, edgarFilingUrl, TRACKED_FORMS, PRESS_RELEASE_ITEMS, EDGAR_USER_AGENT } from "./edgar";
import { fetchDrugApprovals, fetchDrugLabelUpdates } from "./openfda";
import { fetchLeadText } from "./lead-text";
import type { CompanyRow } from "./db-types";

// Runs company fetches with a small concurrency cap so a refresh covering
// 24 companies (SEC + two openFDA endpoints each) stays well inside
// Vercel's serverless function time budget.
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

interface PendingUpdate {
  companyId: string;
  kind: "sec_filing" | "press_release" | "fda_approval" | "fda_label";
  externalId: string;
  title: string;
  summary: string | null;
  url: string | null;
  sourceDate: Date;
}

async function collectForCompany(
  company: CompanyRow,
  errors: string[],
  knownPressReleaseKeys: Set<string>
): Promise<PendingUpdate[]> {
  const pending: PendingUpdate[] = [];

  if (company.cik) {
    try {
      const filings = await fetchRecentFilings(company.cik, 40);
      for (const f of filings) {
        if (!TRACKED_FORMS.has(f.form)) continue;
        const items = (f.items ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        const isPressRelease = f.form.startsWith("8-K") && items.some((it) => PRESS_RELEASE_ITEMS.has(it));
        const sourceDate = new Date(f.filingDate);
        if (Number.isNaN(sourceDate.getTime())) continue;
        const url = edgarFilingUrl(company.cik, f.accessionNumber, f.primaryDocument);

        // A press-release-flagged 8-K carries no real title/summary of its
        // own from SEC's metadata — fetch the actual exhibit and pull its
        // lead paragraph so the item isn't just a bare "item 2.02" label.
        // Skipped for releases already on file: the fetch is the expensive
        // part, and createMany's skipDuplicates would discard the row
        // anyway, so there's no point paying for it twice.
        let leadText: string | null = null;
        if (isPressRelease && !knownPressReleaseKeys.has(`${company.id}:${f.accessionNumber}`)) {
          leadText = await fetchLeadText(url, EDGAR_USER_AGENT);
        }

        pending.push({
          companyId: company.id,
          kind: isPressRelease ? "press_release" : "sec_filing",
          externalId: f.accessionNumber,
          title: isPressRelease
            ? `Press release (via SEC 8-K, item ${items.join("/")})`
            : `SEC filing: ${f.form}${f.primaryDocDescription ? ` — ${f.primaryDocDescription}` : ""}`,
          summary: isPressRelease ? (leadText ?? f.primaryDocDescription ?? null) : f.primaryDocDescription ?? null,
          url,
          sourceDate,
        });
      }
    } catch (e) {
      errors.push(`SEC EDGAR for "${company.name}" failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const sponsorNames = company.fdaSponsorNames.length > 0 ? company.fdaSponsorNames : [company.name];

  try {
    const approvals = await fetchDrugApprovals(sponsorNames);
    for (const a of approvals) {
      pending.push({
        companyId: company.id,
        kind: "fda_approval",
        externalId: a.externalId,
        title: a.title,
        summary: a.summary,
        url: a.url,
        sourceDate: new Date(a.sourceDate),
      });
    }
  } catch (e) {
    errors.push(`openFDA approvals for "${company.name}" failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const labels = await fetchDrugLabelUpdates(sponsorNames);
    for (const l of labels) {
      pending.push({
        companyId: company.id,
        kind: "fda_label",
        externalId: l.externalId,
        title: l.title,
        summary: l.summary,
        url: l.url,
        sourceDate: new Date(l.sourceDate),
      });
    }
  } catch (e) {
    errors.push(`openFDA labels for "${company.name}" failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return pending;
}

export interface CompanyRefreshResult {
  companiesScanned: number;
  updatesFound: number;
  errors: string[];
}

export async function runCompanyRefresh(): Promise<CompanyRefreshResult> {
  await ensureCompaniesSeeded();

  const log = await prisma.companyRefreshLog.create({ data: {} });
  const errors: string[] = [];

  try {
    const companies: CompanyRow[] = await prisma.company.findMany();

    // Existing press-release rows, keyed by "companyId:externalId" — used so
    // collectForCompany only pays for a lead-text fetch on genuinely new
    // press releases, not ones already on file from a prior refresh.
    const existingPressReleases: { companyId: string; externalId: string }[] = await prisma.companyUpdate.findMany({
      where: { kind: "press_release" },
      select: { companyId: true, externalId: true },
    });
    const knownPressReleaseKeys: Set<string> = new Set(
      existingPressReleases.map((r) => `${r.companyId}:${r.externalId}`)
    );

    const perCompany = await mapWithConcurrency(companies, 4, (c) =>
      collectForCompany(c, errors, knownPressReleaseKeys)
    );
    const allPending = perCompany.flat();

    let updatesFound = 0;
    if (allPending.length > 0) {
      // createMany with skipDuplicates relies on the @@unique([companyId,
      // kind, externalId]) constraint to silently ignore items already
      // recorded from a prior refresh — that's how "new since X" works
      // without any separate diffing step (these are append-only source
      // records, not mutable ones like a trial's status).
      const result = await prisma.companyUpdate.createMany({
        data: allPending,
        skipDuplicates: true,
      });
      updatesFound = result.count;
    }

    await prisma.companyRefreshLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        status: errors.length > 0 && companies.length === 0 ? "error" : "success",
        companiesScanned: companies.length,
        updatesFound,
        errorMessage: errors.length ? errors.join(" | ").slice(0, 2000) : null,
      },
    });

    return { companiesScanned: companies.length, updatesFound, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.companyRefreshLog.update({
      where: { id: log.id },
      data: { finishedAt: new Date(), status: "error", errorMessage: msg.slice(0, 2000) },
    });
    throw err;
  }
}
