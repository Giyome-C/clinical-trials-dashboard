"use client";

import type { CompanyRefreshLogDTO, CompanySummary, RefreshLogDTO, Scope } from "@/types";

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function NavRow({
  label,
  count,
  newCount,
  active,
  onClick,
  onRemove,
}: {
  label: string;
  count?: number;
  newCount?: number;
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={`group flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm cursor-pointer ${
        active
          ? "bg-brand/10 text-brand dark:bg-brand-dark/20 dark:text-brand-dark font-medium"
          : "text-ink-secondary hover:bg-ink-muted/10 dark:text-ink-secondary-dark"
      }`}
      onClick={onClick}
    >
      <span className="truncate">{label}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        {!!newCount && (
          <span className="rounded-full bg-status-good text-white text-[10px] font-semibold px-1.5 py-0.5">
            {newCount} new
          </span>
        )}
        {typeof count === "number" && (
          <span className="text-[11px] text-ink-muted tabular-nums">{count}</span>
        )}
        {onRemove && (
          <button
            aria-label={`Remove ${label}`}
            className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-status-critical text-xs px-1"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            ✕
          </button>
        )}
      </span>
    </div>
  );
}

export default function Sidebar({
  companies,
  scope,
  onScopeChange,
  onRefresh,
  refreshing,
  lastRefresh,
  totalTrials,
  selectedCompanyNames,
  onRefreshCompanies,
  refreshingCompanies,
  lastCompanyRefresh,
  totalUpdates,
}: {
  companies: CompanySummary[];
  scope: Scope;
  onScopeChange: (s: Scope) => void;
  onRefresh: () => void;
  refreshing: boolean;
  lastRefresh: RefreshLogDTO | null;
  totalTrials: number;
  selectedCompanyNames: string[];
  onRefreshCompanies: () => void;
  refreshingCompanies: boolean;
  lastCompanyRefresh: CompanyRefreshLogDTO | null;
  totalUpdates: number;
}) {
  const isActive = (s: Scope) => JSON.stringify(s) === JSON.stringify(scope);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-hairline dark:border-hairline-dark bg-surface dark:bg-surface-dark">
      <div className="px-4 py-4 border-b border-hairline dark:border-hairline-dark">
        <h1 className="text-sm font-semibold tracking-tight">Clinical Trials Dashboard</h1>
        <p className="text-[11px] text-ink-muted mt-0.5">
          {totalTrials} trial{totalTrials === 1 ? "" : "s"} tracked · refreshed {timeAgo(lastRefresh?.finishedAt ?? lastRefresh?.startedAt)}
        </p>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-2.5 w-full rounded-md border border-hairline dark:border-hairline-dark bg-brand text-white text-xs font-medium py-1.5 hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {refreshing ? "Refreshing…" : "Refresh now"}
        </button>
        {lastRefresh?.status === "error" && (
          <p className="mt-1.5 text-[10px] text-status-critical">Last refresh had errors — see server logs.</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
        <div>
          <div className="px-1 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Tracked Companies</span>
          </div>

          <NavRow
            label="All tracked companies"
            count={totalUpdates}
            active={isActive({ domain: "company", type: "all" })}
            onClick={() => onScopeChange({ domain: "company", type: "all" })}
          />
          <NavRow
            label="New Today"
            active={isActive({ domain: "company", type: "today" })}
            onClick={() => onScopeChange({ domain: "company", type: "today" })}
          />
          <NavRow
            label="New this Week"
            active={isActive({ domain: "company", type: "week" })}
            onClick={() => onScopeChange({ domain: "company", type: "week" })}
          />

          <p className="mt-2 px-1 text-[10px] text-ink-muted">
            {selectedCompanyNames.length} of {companies.length} selected · refreshed{" "}
            {timeAgo(lastCompanyRefresh?.finishedAt ?? lastCompanyRefresh?.startedAt)}
          </p>
          <button
            onClick={onRefreshCompanies}
            disabled={refreshingCompanies}
            className="mt-1.5 mb-1.5 w-full rounded-md border border-hairline dark:border-hairline-dark bg-transparent text-ink-secondary dark:text-ink-secondary-dark text-[11px] font-medium py-1 hover:bg-ink-muted/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {refreshingCompanies ? "Refreshing…" : "Refresh companies"}
          </button>
          {lastCompanyRefresh?.status === "error" && (
            <p className="mb-1.5 px-1 text-[10px] text-status-critical">Last company refresh had errors — see server logs.</p>
          )}
        </div>

        <div>
          <div className="px-1 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Tracked Trials</span>
          </div>
          <NavRow
            label="All tracked trials"
            active={isActive({ domain: "trial", type: "all" })}
            onClick={() => onScopeChange({ domain: "trial", type: "all" })}
          />
          <NavRow
            label="Updates since last refresh"
            active={isActive({ domain: "trial", type: "changed" })}
            onClick={() => onScopeChange({ domain: "trial", type: "changed" })}
          />
          <NavRow
            label="New Today"
            active={isActive({ domain: "trial", type: "today" })}
            onClick={() => onScopeChange({ domain: "trial", type: "today" })}
          />
          <NavRow
            label="New this Week"
            active={isActive({ domain: "trial", type: "week" })}
            onClick={() => onScopeChange({ domain: "trial", type: "week" })}
          />
        </div>
      </div>
    </aside>
  );
}
