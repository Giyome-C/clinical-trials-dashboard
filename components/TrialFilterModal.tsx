"use client";

import { useMemo, useState } from "react";
import type { CompoundDTO, IndicationDTO } from "@/types";

// Popup used by TrialList's "Filter" button (top-right of the center pane,
// above the search bar) — mirrors CompanyFilterModal's layout/behavior so
// the two domains feel consistent. Filters by indication and by compound
// independently; each also doubles as the place to add a new one (the
// sidebar's old dedicated "+ Add" forms for these moved here).
export default function TrialFilterModal({
  onClose,
  indications,
  selectedIndicationNames,
  onToggleIndication,
  onSelectAllIndications,
  onClearIndications,
  onAddIndication,
  onRemoveIndication,
  compounds,
  selectedCompoundNames,
  onToggleCompound,
  onSelectAllCompounds,
  onClearCompounds,
  onAddCompound,
  onRemoveCompound,
}: {
  onClose: () => void;
  indications: IndicationDTO[];
  selectedIndicationNames: string[];
  onToggleIndication: (name: string) => void;
  onSelectAllIndications: () => void;
  onClearIndications: () => void;
  onAddIndication: (name: string) => void;
  onRemoveIndication: (name: string) => void;
  compounds: CompoundDTO[];
  selectedCompoundNames: string[];
  onToggleCompound: (name: string) => void;
  onSelectAllCompounds: () => void;
  onClearCompounds: () => void;
  onAddCompound: (name: string, aliases: string[]) => void;
  onRemoveCompound: (name: string) => void;
}) {
  const [indicationQuery, setIndicationQuery] = useState("");
  const [newIndication, setNewIndication] = useState("");
  const [compoundQuery, setCompoundQuery] = useState("");
  const [newCompound, setNewCompound] = useState("");

  const filteredIndications = useMemo(
    () => indications.filter((i) => i.name.toLowerCase().includes(indicationQuery.toLowerCase())),
    [indications, indicationQuery]
  );
  const filteredCompounds = useMemo(
    () =>
      compounds.filter((c) =>
        (c.name + " " + c.aliases.join(" ")).toLowerCase().includes(compoundQuery.toLowerCase())
      ),
    [compounds, compoundQuery]
  );

  const allIndicationsSelected = indications.length > 0 && selectedIndicationNames.length === indications.length;
  const allCompoundsSelected = compounds.length > 0 && selectedCompoundNames.length === compounds.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-20" onClick={onClose}>
      <div
        className="flex w-full max-w-sm max-h-[75vh] flex-col rounded-lg border border-hairline dark:border-hairline-dark bg-surface dark:bg-surface-dark shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline dark:border-hairline-dark">
          <h3 className="text-sm font-semibold">Filter trials</h3>
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
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Indications</span>
              <button
                className="text-[11px] text-brand dark:text-brand-dark hover:underline"
                onClick={allIndicationsSelected ? onClearIndications : onSelectAllIndications}
              >
                {allIndicationsSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <input
              value={indicationQuery}
              onChange={(e) => setIndicationQuery(e.target.value)}
              placeholder="Search indications…"
              className="mb-1.5 w-full rounded border border-hairline dark:border-hairline-dark bg-transparent px-2 py-1 text-xs"
            />
            <div className="max-h-40 overflow-y-auto rounded-md border border-hairline/60 dark:border-hairline-dark/60">
              {filteredIndications.map((ind) => (
                <label
                  key={ind.id}
                  className="group flex items-center gap-2 border-b border-hairline/40 px-2 py-1.5 text-[12px] text-ink-secondary last:border-b-0 hover:bg-ink-muted/10 dark:border-hairline-dark/40 dark:text-ink-secondary-dark cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIndicationNames.includes(ind.name)}
                    onChange={() => onToggleIndication(ind.name)}
                    className="h-3.5 w-3.5 shrink-0 accent-brand"
                  />
                  <span className="flex-1 truncate">{ind.name}</span>
                  <span className="text-[10px] text-ink-muted tabular-nums">{ind.count}</span>
                  {!ind.isDefault && (
                    <button
                      aria-label={`Remove ${ind.name}`}
                      className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-status-critical text-xs px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRemoveIndication(ind.name);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </label>
              ))}
              {filteredIndications.length === 0 && (
                <p className="px-2 py-2 text-[11px] text-ink-muted">No indications match "{indicationQuery}".</p>
              )}
            </div>
            <form
              className="mt-1.5 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (newIndication.trim()) {
                  onAddIndication(newIndication.trim());
                  setNewIndication("");
                }
              }}
            >
              <input
                value={newIndication}
                onChange={(e) => setNewIndication(e.target.value)}
                placeholder="e.g. Alopecia Areata"
                className="min-w-0 flex-1 rounded border border-hairline dark:border-hairline-dark bg-transparent px-2 py-1 text-xs"
              />
              <button type="submit" className="shrink-0 rounded bg-brand px-2 text-xs text-white">
                Add
              </button>
            </form>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Compounds</span>
              <button
                className="text-[11px] text-brand dark:text-brand-dark hover:underline"
                onClick={allCompoundsSelected ? onClearCompounds : onSelectAllCompounds}
              >
                {allCompoundsSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <input
              value={compoundQuery}
              onChange={(e) => setCompoundQuery(e.target.value)}
              placeholder="Search compounds…"
              className="mb-1.5 w-full rounded border border-hairline dark:border-hairline-dark bg-transparent px-2 py-1 text-xs"
            />
            <div className="max-h-40 overflow-y-auto rounded-md border border-hairline/60 dark:border-hairline-dark/60">
              {filteredCompounds.map((c) => (
                <label
                  key={c.id}
                  className="group flex items-center gap-2 border-b border-hairline/40 px-2 py-1.5 text-[12px] text-ink-secondary last:border-b-0 hover:bg-ink-muted/10 dark:border-hairline-dark/40 dark:text-ink-secondary-dark cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCompoundNames.includes(c.name)}
                    onChange={() => onToggleCompound(c.name)}
                    className="h-3.5 w-3.5 shrink-0 accent-brand"
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[10px] text-ink-muted tabular-nums">{c.count}</span>
                  {!c.isDefault && (
                    <button
                      aria-label={`Remove ${c.name}`}
                      className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-status-critical text-xs px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRemoveCompound(c.name);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </label>
              ))}
              {filteredCompounds.length === 0 && (
                <p className="px-2 py-2 text-[11px] text-ink-muted">No compounds match "{compoundQuery}".</p>
              )}
            </div>
            <form
              className="mt-1.5 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (newCompound.trim()) {
                  onAddCompound(newCompound.trim(), []);
                  setNewCompound("");
                }
              }}
            >
              <input
                value={newCompound}
                onChange={(e) => setNewCompound(e.target.value)}
                placeholder="Compound name / code"
                className="min-w-0 flex-1 rounded border border-hairline dark:border-hairline-dark bg-transparent px-2 py-1 text-xs"
              />
              <button type="submit" className="shrink-0 rounded bg-brand px-2 text-xs text-white">
                Add
              </button>
            </form>
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
