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

// Compact large-number formatting for market cap / net income / cash, e.g.
// 228_250_000_000 -> "$228.25B".
function fmtLarge(v: number | null | undefined, currency: string | null | undefined): string {
  if (v == null) return "—";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const symbol = !currency || currency === "USD" ? "$" : "";
  const suffix = currency && currency !== "USD" ? ` ${currency}` : "";
  if (abs >= 1e12) return `${sign}${symbol}${(abs / 1e12).toFixed(2)}T${suffix}`;
  if (abs >= 1e9) return `${sign}${symbol}${(abs / 1e9).toFixed(2)}B${suffix}`;
  if (abs >= 1e6) return `${sign}${symbol}${(abs / 1e6).toFixed(2)}M${suffix}`;
  if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(2)}K${suffix}`;
  return `${sign}${symbol}${abs.toFixed(2)}${suffix}`;
}

function fmtPercent(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtEarningsDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Trend sparkline: the historical line rides the de-emphasis (muted) ink
// token, with just the current point picked out in the brand accent — no
// axes, gridlines, or labels, since a single-series trend next to its own
// value needs none of those (see dataviz skill: stat-tile sparkline spec).
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 84;
  const h = 26;
  const pad = 3;
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
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="2" className="text-brand dark:text-brand-dark" fill="currentColor" />
    </svg>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[12px]">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
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
        snapshot (price, 52-week average, market cap, and more).
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold leading-snug">{update.companyName}</h1>
            {update.companyTicker && <p className="text-xs text-ink-muted mt-0.5">{update.companyTicker}</p>}
          </div>
          <span className="shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-brand/10 text-brand dark:bg-brand-dark/20 dark:text-brand-dark">
            {KIND_LABELS[update.kind]}
          </span>
        </div>

        <h2 className="mt-3 pb-4 border-b border-hairline dark:border-hairline-dark text-lg font-semibold leading-snug">
          {update.title}
        </h2>

        {update.companyTicker && (
          <div className="mt-4 rounded-lg border border-hairline dark:border-hairline-dark p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold tabular-nums">{fmtPrice(quote?.price, quote?.currency)}</div>
                {quote?.fiftyTwoWeekAverage != null && (
                  <div className="text-[11px] text-ink-muted tabular-nums mt-0.5">
                    52-wk avg: {fmtPrice(quote.fiftyTwoWeekAverage, quote.currency)}
                  </div>
                )}
                {!quote && <div className="text-[11px] text-ink-muted mt-0.5">Quote unavailable</div>}
              </div>
              {quote?.sparkline && quote.sparkline.length > 1 && <Sparkline values={quote.sparkline} />}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-hairline dark:border-hairline-dark pt-3">
              <SnapshotRow label="Market cap" value={fmtLarge(quote?.marketCap, quote?.currency)} />
              <SnapshotRow label="Next earnings" value={fmtEarningsDate(quote?.nextEarningsDate)} />
              <SnapshotRow label="Net income" value={fmtLarge(quote?.netIncome, quote?.currency)} />
              <SnapshotRow label="Profit margin" value={fmtPercent(quote?.profitMargin)} />
              <SnapshotRow label="Total cash" value={fmtLarge(quote?.totalCash, quote?.currency)} />
            </div>
          </div>
        )}

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
