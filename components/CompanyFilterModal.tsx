"use client";

import { useMemo, useState } from "react";
import type { CompanySummary, CompanyUpdateSummary } from "@/types";
import { COMPANY_UPDATE_KINDS } from "@/types";

const KIND_LABELS: Record<CompanyUpdateSummary["kind"], string> = {
  sec_filing: "SEC Filing",
  press_release: "Press Release",
  fda_approval: "FDA Approval",
  fda_label: "FDA Label",
};

// Popup used by CompanyList's "Filter" button (top-right of the center
// pane, above the search bar) — replaces the old always-visible sidebar
// checkbox list so the company-filter and update-type-filter controls live
// in one place next to the list they affect.
export default function CompanyFilterModal({
  onClose,
  companies,
  selectedCompanyNames,
  onToggleCompany,
  onSelectAllCompanies,
  onClearCompanies,
  onAddCompany,
  onRemoveCompany,
  selectedKinds,
  onToggleKind,
  onSelectAllKinds,
  onClearKinds,
}: {
  onClose: () => void;
  companies: CompanySummary[];
  selectedCompanyNames: string[];
  onToggleCompany: (name: string) => void;
  onSelectAllCompanies: () => void;
  onClearCompanies: () => void;
  onAddCompany: (name: string, ticker: string | null) => void;
  onRemoveCompany: (name: string) => void;
  selectedKinds: CompanyUpdateSummary["kind"][];
  onToggleKind: (kind: CompanyUpdateSummary["kind"]) => void;
  onSelectAllKinds: () => void;
  onClearKinds: () => void;
}) {
  const [companyQuery, setCompanyQuery] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyTicker, setNewCompanyTicker] = useState("");

  const filteredCompanies = useMemo(
    () => companies.filter((c) => c.name.toLowerCase().includes(companyQuery.toLowerCase())),
    [companies, companyQuery]
  );

  const allCompaniesSelected = companies.length > 0 && selectedCompanyNames.length === companies.length;
  const allKindsSelected = selectedKinds.length === COMPANY_UPDATE_KINDS.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-20" onClick={onClose}>
      <div
        className="flex w-full max-w-sm max-h-[75vh] flex-col rounded-lg border border-hairline dark:border-hairline-dark bg-surface dark:bg-surface-dark shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline dark:border-hairline-dark">
          <h3 className="text-sm font-semibold">Filter updates</h3>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-ink-muted hover:text-ink-primary dark:hover:text-ink-primary-dark text-sm px-1"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Companies</span>
              <button
                className="text-[11px] text-brand dark:text-brand-dark hover:underline"
                onClick={allCompaniesSelected ? onClearCompanies : onSelectAllCompanies}
              >
                {allCompaniesSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <input
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
              placeholder="Search companies…"
              className="mb-1.5 w-full rounded border border-hairline dark:border-hairline-dark bg-transparent px-2 py-1 text-xs"
            />
            <div className="max-h-48 overflow-y-auto rounded-md border border-hairline/60 dark:border-hairline-dark/60">
              {filteredCompanies.map((c) => (
                <label
                  key={c.id}
                  className="group flex items-center gap-2 border-b border-hairline/40 px-2 py-1.5 text-[12px] text-ink-secondary last:border-b-0 hover:bg-ink-muted/10 dark:border-hairline-dark/40 dark:text-ink-secondary-dark cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCompanyNames.includes(c.name)}
                    onChange={() => onToggleCompany(c.name)}
                    className="h-3.5 w-3.5 shrink-0 accent-brand"
                  />
                  <span className="flex-1 truncate">
                    {c.name}
                    {c.ticker && <span className="text-ink-muted"> ({c.ticker})</span>}
                  </span>
                  <span className="text-[10px] text-ink-muted tabular-nums">{c.count}</span>
                  {!c.isDefault && (
                    <button
                      aria-label={`Remove ${c.name}`}
                      className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-status-critical text-xs px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRemoveCompany(c.name);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </label>
              ))}
              {filteredCompanies.length === 0 && (
                <p className="px-2 py-2 text-[11px] text-ink-muted">No companies match "{companyQuery}".</p>
              )}
            </div>

            {/* No general company-lookup API exists, so "add" is the same
                manual name+ticker entry the sidebar used to offer — just
                relocated here per the request to consolidate filtering. */}
            <form
              className="mt-1.5 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (newCompanyName.trim()) {
                  onAddCompany(newCompanyName.trim(), newCompanyTicker.trim() || null);
                  setNewCompanyName("");
                  setNewCompanyTicker("");
                }
              }}
            >
              <input
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Add a company…"
                className="min-w-0 flex-1 rounded border border-hairline dark:border-hairline-dark bg-transparent px-2 py-1 text-xs"
              />
              <input
                value={newCompanyTicker}
                onChange={(e) => setNewCompanyTicker(e.target.value)}
                placeholder="Ticker"
                className="w-16 min-w-0 rounded border border-hairline dark:border-hairline-dark bg-transparent px-2 py-1 text-xs"
              />
              <button type="submit" className="shrink-0 rounded bg-brand px-2 text-xs text-white">
                Add
              </button>
            </form>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Update type</span>
              <button
                className="text-[11px] text-brand dark:text-brand-dark hover:underline"
                onClick={allKindsSelected ? onClearKinds : onSelectAllKinds}
              >
                {allKindsSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="space-y-1">
              {COMPANY_UPDATE_KINDS.map((kind) => (
                <label
                  key={kind}
                  className="flex items-center gap-2 rounded px-1 py-1 text-[12px] text-ink-secondary hover:bg-ink-muted/10 dark:text-ink-secondary-dark cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedKinds.includes(kind)}
                    onChange={() => onToggleKind(kind)}
                    className="h-3.5 w-3.5 shrink-0 accent-brand"
                  />
                  <span>{KIND_LABELS[kind]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-hairline dark:border-hairline-dark px-4 py-2.5">
          <button
            onClick={onClose}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
