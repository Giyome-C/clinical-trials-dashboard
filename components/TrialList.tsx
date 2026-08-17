"use client";

import type { Scope, TrialSummary } from "@/types";
import StatusBadge from "./StatusBadge";

function formatPhase(phases: string[]): string | null {
  if (!phases.length) return null;
  return phases.map((p) => p.replace("PHASE", "Phase ").replace("EARLY_", "Early ")).join(" / ");
}

// CT.gov's lastUpdatePosted is a plain "YYYY-MM-DD" (sometimes "YYYY-MM")
// string — no time of day, since CT.gov itself doesn't publish one. Parse
// leniently and fall back to the raw string if it's not a full date.
function formatPostedDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length < 2) return dateStr;
  const [year, month, day] = parts.map(Number);
  const d = new Date(year, (month || 1) - 1, day || 1);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    ...(day ? { day: "numeric" } : {}),
  });
}

// lastChangedAt is a real timestamp this dashboard recorded the moment it
// detected a diff, so — unlike CT.gov's date-only field — it can show a
// precise date and time.
function formatDetectedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function scopeTitle(scope: Scope): string {
  switch (scope.type) {
    case "all":
      return "All tracked trials";
    case "changed":
      return "Updates since last refresh";
    case "today":
      return "New Today";
    case "week":
      return "New this Week";
    case "indication":
      return scope.value;
    case "compound":
      return scope.value;
  }
}

export default function TrialList({
  scope,
  trials,
  loading,
  selectedNctId,
  onSelect,
  search,
  onSearchChange,
}: {
  scope: Scope;
  trials: TrialSummary[];
  loading: boolean;
  selectedNctId: string | null;
  onSelect: (nctId: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <section className="flex h-full w-[420px] shrink-0 flex-col border-r border-hairline dark:border-hairline-dark bg-surface-page dark:bg-surface-dark-page">
      <div className="px-4 py-3 border-b border-hairline dark:border-hairline-dark">
        <h2 className="text-sm font-semibold truncate">{scopeTitle(scope)}</h2>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search title, NCT ID, sponsor…"
          className="mt-2 w-full rounded-md border border-hairline dark:border-hairline-dark bg-surface dark:bg-surface-dark px-2.5 py-1.5 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <p className="px-4 py-6 text-xs text-ink-muted">Loading…</p>}
        {!loading && trials.length === 0 && (
          <p className="px-4 py-6 text-xs text-ink-muted">No trials match this view yet.</p>
        )}
        {trials.map((t) => {
          const active = t.nctId === selectedNctId;
          const phase = formatPhase(t.phases);
          // Prefer the precise moment *this dashboard* detected a change;
          // fall back to CT.gov's own (date-only) last-update-posted field
          // for trials that haven't changed since their first snapshot.
          const detectedAt = formatDetectedAt(t.lastChangedAt);
          const postedDate = formatPostedDate(t.lastUpdatePosted);
          return (
            <button
              key={t.nctId}
              onClick={() => onSelect(t.nctId)}
              className={`block w-full text-left px-4 py-2.5 border-b border-hairline/70 dark:border-hairline-dark/70 transition-colors ${
                active
                  ? "bg-brand/10 dark:bg-brand-dark/15"
                  : "hover:bg-ink-muted/5 dark:hover:bg-ink-muted/10"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-medium leading-snug line-clamp-2">{t.briefTitle}</span>
                {(t.isNewSinceLastRefresh || t.changedInLastRefresh) && (
                  <span
                    className={`shrink-0 mt-0.5 rounded-full text-[9px] font-bold px-1.5 py-0.5 text-white ${
                      t.isNewSinceLastRefresh ? "bg-status-good" : "bg-brand"
                    }`}
                  >
                    {t.isNewSinceLastRefresh ? "NEW" : "UPDATED"}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-secondary dark:text-ink-secondary-dark">
                <StatusBadge status={t.overallStatus} compact />
                {phase && <span>{phase}</span>}
                {typeof t.enrollmentCount === "number" && <span>N={t.enrollmentCount}</span>}
                {t.sponsorName && <span className="truncate">{t.sponsorName}</span>}
              </div>
              {t.changeSummary && (
                <div className="mt-1 text-[11px] text-brand dark:text-brand-dark">{t.changeSummary}</div>
              )}
              <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-ink-muted tabular-nums">
                <span>{t.nctId}</span>
                {detectedAt ? (
                  <span>Updated: {detectedAt}</span>
                ) : (
                  postedDate && <span>Posted: {postedDate}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
