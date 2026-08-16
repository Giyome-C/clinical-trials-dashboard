"use client";

import { useState } from "react";
import type { CompoundDTO, IndicationDTO, RefreshLogDTO, Scope } from "@/types";

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
  indications,
  compounds,
  scope,
  onScopeChange,
  onAddIndication,
  onRemoveIndication,
  onAddCompound,
  onRemoveCompound,
  onRefresh,
  refreshing,
  lastRefresh,
  totalTrials,
}: {
  indications: IndicationDTO[];
  compounds: CompoundDTO[];
  scope: Scope;
  onScopeChange: (s: Scope) => void;
  onAddIndication: (name: string) => void;
  onRemoveIndication: (name: string) => void;
  onAddCompound: (name: string, aliases: string[]) => void;
  onRemoveCompound: (name: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  lastRefresh: RefreshLogDTO | null;
  totalTrials: number;
}) {
  const [addingIndication, setAddingIndication] = useState(false);
  const [newIndication, setNewIndication] = useState("");
  const [addingCompound, setAddingCompound] = useState(false);
  const [newCompound, setNewCompound] = useState("");
  const [compoundQuery, setCompoundQuery] = useState("");

  const filteredCompounds = compounds.filter((c) =>
    (c.name + " " + c.aliases.join(" ")).toLowerCase().includes(compoundQuery.toLowerCase())
  );

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
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Views</span>
          </div>
          <NavRow label="All tracked trials" active={isActive({ type: "all" })} onClick={() => onScopeChange({ type: "all" })} />
          <NavRow label="New this refresh" active={isActive({ type: "new" })} onClick={() => onScopeChange({ type: "new" })} />
          <NavRow label="Changed this refresh" active={isActive({ type: "changed" })} onClick={() => onScopeChange({ type: "changed" })} />
        </div>

        <div>
          <div className="px-1 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Indications</span>
            <button
              className="text-[11px] text-brand dark:text-brand-dark hover:underline"
              onClick={() => setAddingIndication((v) => !v)}
            >
              + Add
            </button>
          </div>
          {addingIndication && (
            <form
              className="px-1 mb-1.5 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (newIndication.trim()) {
                  onAddIndication(newIndication.trim());
                  setNewIndication("");
                  setAddingIndication(false);
                }
              }}
            >
              <input
                autoFocus
                value={newIndication}
                onChange={(e) => setNewIndication(e.target.value)}
                placeholder="e.g. Alopecia Areata"
                className="flex-1 min-w-0 rounded border border-hairline dark:border-hairline-dark bg-transparent px-2 py-1 text-xs"
              />
              <button type="submit" className="text-xs px-2 rounded bg-brand text-white">
                Add
              </button>
            </form>
          )}
          {indications.map((ind) => (
            <NavRow
              key={ind.id}
              label={ind.name}
              count={ind.count}
              newCount={ind.newCount}
              active={isActive({ type: "indication", value: ind.name })}
              onClick={() => onScopeChange({ type: "indication", value: ind.name })}
              onRemove={ind.isDefault ? undefined : () => onRemoveIndication(ind.name)}
            />
          ))}
        </div>

        <div>
          <div className="px-1 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Compound-driven search</span>
            <button
              className="text-[11px] text-brand dark:text-brand-dark hover:underline"
              onClick={() => setAddingCompound((v) => !v)}
            >
              + Add
            </button>
          </div>
          {addingCompound && (
            <form
              className="px-1 mb-1.5 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (newCompound.trim()) {
                  onAddCompound(newCompound.trim(), []);
                  setNewCompound("");
                  setAddingCompound(false);
                }
              }}
            >
              <input
                autoFocus
                value={newCompound}
                onChange={(e) => setNewCompound(e.target.value)}
                placeholder="Compound name / code"
                className="flex-1 min-w-0 rounded border border-hairline dark:border-hairline-dark bg-transparent px-2 py-1 text-xs"
              />
              <button type="submit" className="text-xs px-2 rounded bg-brand text-white">
                Add
              </button>
            </form>
          )}
          <div className="px-1 mb-1.5">
            <input
              value={compoundQuery}
              onChange={(e) => setCompoundQuery(e.target.value)}
              placeholder="Filter compounds…"
              className="w-full rounded border border-hairline dark:border-hairline-dark bg-transparent px-2 py-1 text-xs"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredCompounds.map((c) => (
              <NavRow
                key={c.id}
                label={c.name}
                count={c.count}
                newCount={c.newCount}
                active={isActive({ type: "compound", value: c.name })}
                onClick={() => onScopeChange({ type: "compound", value: c.name })}
                onRemove={c.isDefault ? undefined : () => onRemoveCompound(c.name)}
              />
            ))}
            {filteredCompounds.length === 0 && (
              <p className="px-2 py-1 text-[11px] text-ink-muted">No compounds match “{compoundQuery}”.</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
