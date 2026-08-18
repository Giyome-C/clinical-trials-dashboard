import { prisma } from "./db";
import { ensureCompaniesSeeded } from "./seed";
import { fetchRecentFilings, edgarFilingUrl, TRACKED_FORMS, PRESS_RELEASE_ITEMS } from "./edgar";
import { fetchDrugApprovals, fetchDrugLabelUpdates } from "./openfda";
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

async function collectForCompany(company: CompanyRow, errors: string[]): Promise<PendingUpdate[]> {
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
        pending.push({
          companyId: company.id,
          kind: isPressRelease ? "press_release" : "sec_filing",
          externalId: f.accessionNumber,
          title: isPressRelease
            ? `Press release (via SEC 8-K, item ${items.join("/")})`
            : `SEC filing: ${f.form}${f.primaryDocDescription ? ` — ${f.primaryDocDescription}` : ""}`,
          summary: f.primaryDocDescription ?? null,
          url: edgarFilingUrl(company.cik, f.accessionNumber, f.primaryDocument),
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

    const perCompany = await mapWithConcurrency(companies, 4, (c) => collectForCompany(c, errors));
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
