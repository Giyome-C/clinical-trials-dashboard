"use client";

import type { CompanyScope, CompanyUpdateSummary } from "@/types";

const KIND_META: Record<CompanyUpdateSummary["kind"], { label: string; className: string }> = {
  sec_filing: {
    label: "SEC Filing",
    className: "bg-ink-muted/10 text-ink-secondary dark:text-ink-secondary-dark dark:bg-ink-muted/20",
  },
  press_release: {
    label: "Press Release",
    className: "bg-brand/10 text-brand dark:bg-brand-dark/20 dark:text-brand-dark",
  },
  fda_approval: {
    label: "FDA Approval",
    className: "bg-status-good/10 text-status-good dark:bg-status-good/20",
  },
  fda_label: {
    label: "FDA Label",
    className: "bg-status-warning/15 text-[#8a5a00] dark:text-status-warning dark:bg-status-warning/20",
  },
};

function formatTimestamp(iso: string | null): string | null {
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

function formatSourceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function scopeTitle(scope: CompanyScope): string {
  switch (scope.type) {
    case "all":
      return "All tracked companies";
    case "today":
      return "New Today";
    case "week":
      return "New this Week";
  }
}

export default function CompanyList({
  scope,
  updates,
  loading,
  selectedId,
  onSelect,
  search,
  onSearchChange,
}: {
  scope: CompanyScope;
  updates: CompanyUpdateSummary[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
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
          placeholder="Search title, company…"
          className="mt-2 w-full rounded-md border border-hairline dark:border-hairline-dark bg-surface dark:bg-surface-dark px-2.5 py-1.5 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <p className="px-4 py-6 text-xs text-ink-muted">Loading…</p>}
        {!loading && updates.length === 0 && (
          <p className="px-4 py-6 text-xs text-ink-muted">No updates match this view yet.</p>
        )}
        {updates.map((u) => {
          const active = u.id === selectedId;
          const meta = KIND_META[u.kind];
          const seenAt = formatTimestamp(u.firstSeenAt);
          return (
            <button
              key={u.id}
              onClick={() => onSelect(u.id)}
              className={`block w-full text-left px-4 py-2.5 border-b border-hairline/70 dark:border-hairline-dark/70 transition-colors ${
                active
                  ? "bg-brand/10 dark:bg-brand-dark/15"
                  : "hover:bg-ink-muted/5 dark:hover:bg-ink-muted/10"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-medium">
                  {u.companyName}
                  {u.companyTicker && <span className="text-ink-muted"> ({u.companyTicker})</span>}
                </span>
                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>
                  {meta.label}
                </span>
              </div>
              <span className="mt-1 block text-[13px] leading-snug line-clamp-2">{u.title}</span>
              {u.summary && u.summary !== u.title && !u.title.includes(u.summary) && (
                <div className="mt-1 text-[11px] text-ink-secondary dark:text-ink-secondary-dark line-clamp-2">
                  {u.summary}
                </div>
              )}
              <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-ink-muted tabular-nums">
                <span>{formatSourceDate(u.sourceDate)}</span>
                {seenAt && <span>Seen: {seenAt}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
