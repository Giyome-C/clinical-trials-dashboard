"use client";

import type { CompanyUpdateDetailDTO, StockQuoteDTO } from "@/types";

const KIND_LABELS: Record<CompanyUpdateDetailDTO["kind"], string> = {
  sec_filing: "SEC Filing",
  press_release: "Press Release",
  fda_approval: "FDA Approval",
  fda_label: "FDA Label",
};

function fmtPrice(v: number | null, currency: string | null): string {
  if (v == null) return "—";
  const amount = v.toFixed(2);
  return !currency || currency === "USD" ? `$${amount}` : `${amount} ${currency}`;
}

export default function CompanyDetail({
  update,
  quote,
  loading,
}: {
  update: CompanyUpdateDetailDTO | null;
  quote: StockQuoteDTO | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="flex-1 flex items-center justify-center text-xs text-ink-muted">
        Loading update…
      </section>
    );
  }

  if (!update) {
    return (
      <section className="flex-1 flex items-center justify-center text-xs text-ink-muted px-8 text-center">
        Select an update from the list to see its full detail — filing type, source link, and a company
        snapshot (price, 52-week average).
      </section>
    );
  }

  return (
    <section className="flex-1 overflow-y-auto bg-surface dark:bg-surface-dark">
      <div className="max-w-3xl px-8 py-6">
        <div className="flex items-baseline justify-between gap-4 border-b border-hairline dark:border-hairline-dark pb-4">
          <div>
            <h1 className="text-lg font-semibold leading-snug">{update.companyName}</h1>
            {update.companyTicker && <p className="text-xs text-ink-muted mt-0.5">{update.companyTicker}</p>}
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-semibold tabular-nums">
              {update.companyTicker ? fmtPrice(quote?.price ?? null, quote?.currency ?? null) : "Not publicly traded"}
            </div>
            {quote?.fiftyTwoWeekAverage != null && (
              <div className="text-[11px] text-ink-muted tabular-nums">
                52-wk avg: {fmtPrice(quote.fiftyTwoWeekAverage, quote.currency)}
              </div>
            )}
            {update.companyTicker && !quote && (
              <div className="text-[11px] text-ink-muted">Quote unavailable</div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-brand/10 text-brand dark:bg-brand-dark/20 dark:text-brand-dark">
            {KIND_LABELS[update.kind]}
          </span>

          <h2 className="mt-3 text-lg font-semibold leading-snug">{update.title}</h2>

          {update.summary && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary dark:text-ink-secondary-dark whitespace-pre-line">
              {update.summary}
            </p>
          )}

          {update.url && (
            <a
              href={update.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs text-brand dark:text-brand-dark hover:underline"
            >
              View source ↗
            </a>
          )}

          <p className="mt-6 text-[10px] text-ink-muted">
            Source date {new Date(update.sourceDate).toLocaleDateString()} · first seen{" "}
            {new Date(update.firstSeenAt).toLocaleString()}
            {quote && <> · quote as of {new Date(quote.asOf).toLocaleTimeString()}</>}
          </p>
        </div>
      </div>
    </section>
  );
}
