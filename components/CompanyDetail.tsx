"use client";

import type { CompanyUpdateDetailDTO, StockQuoteDTO } from "@/types";

const KIND_LABELS: Record<CompanyUpdateDetailDTO["kind"], string> = {
  sec_filing: "SEC Filing",
  press_release: "Press Release",
  fda_approval: "FDA Approval",
  fda_label: "FDA Label",
};

function fmtPrice(v: number | null | undefined, currency: string | null | undefined): string {
  if (v == null) return "—";
  const amount = v.toFixed(2);
  return !currency || currency === "USD" ? `$${amount}` : `${amount} ${currency}`;
}

// Trend sparkline: the historical line rides the de-emphasis (muted) ink
// token, with just the current point picked out in the brand accent — no
// axes, gridlines, or labels, since a single-series trend next to its own
// value needs none of those (see dataviz skill: stat-tile sparkline spec).
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 52;
  const h = 18;
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" role="img" aria-label="52-week price trend">
      <polyline
        points={path}
        fill="none"
        className="text-ink-muted"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="1.5" className="text-brand dark:text-brand-dark" fill="currentColor" />
    </svg>
  );
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
        price snapshot.
      </section>
    );
  }

  // The SEC/openFDA-derived summary often just restates the title (both are
  // sourced from the same short document description) — skip the redundant
  // second copy when that's the case.
  const showSummary = update.summary && update.summary !== update.title && !update.title.includes(update.summary);

  return (
    <section className="flex-1 overflow-y-auto bg-surface dark:bg-surface-dark">
      <div className="max-w-3xl px-8 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold leading-snug truncate">{update.companyName}</h1>
          <div className="flex items-center gap-3 shrink-0">
            {update.companyTicker && quote && (
              <div className="flex items-center gap-2">
                <Sparkline values={quote.sparkline} />
                <div className="text-right leading-tight">
                  <div className="text-[13px] font-semibold tabular-nums">{fmtPrice(quote.price, quote.currency)}</div>
                  {quote.fiftyTwoWeekAverage != null && (
                    <div className="text-[10px] text-ink-muted tabular-nums">
                      52-wk avg {fmtPrice(quote.fiftyTwoWeekAverage, quote.currency)}
                    </div>
                  )}
                </div>
              </div>
            )}
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-brand/10 text-brand dark:bg-brand-dark/20 dark:text-brand-dark">
              {KIND_LABELS[update.kind]}
            </span>
          </div>
        </div>

        <h2 className="mt-3 pb-4 border-b border-hairline dark:border-hairline-dark text-xl font-semibold leading-snug">
          {update.title}
        </h2>

        <div className="mt-5">
          {showSummary && (
            <p className="text-[13px] leading-relaxed text-ink-secondary dark:text-ink-secondary-dark whitespace-pre-line">
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
