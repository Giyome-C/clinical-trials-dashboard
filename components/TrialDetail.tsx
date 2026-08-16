"use client";

import type { TrialDetailDTO } from "@/types";
import StatusBadge from "./StatusBadge";
import { getStatusMeta, FIELD_LABELS, formatChangeValue } from "@/lib/statuses";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5 text-[13px]">
      <span className="text-ink-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function TrialDetail({
  trial,
  loading,
}: {
  trial: TrialDetailDTO | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="flex-1 flex items-center justify-center text-xs text-ink-muted">
        Loading trial…
      </section>
    );
  }

  if (!trial) {
    return (
      <section className="flex-1 flex items-center justify-center text-xs text-ink-muted px-8 text-center">
        Select a trial from the list to see its full detail — status, dates, enrollment, interventions, and
        its change history.
      </section>
    );
  }

  const statusMeta = getStatusMeta(trial.overallStatus);

  return (
    <section className="flex-1 overflow-y-auto bg-surface dark:bg-surface-dark">
      <div className="max-w-3xl px-8 py-6">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <StatusBadge status={trial.overallStatus} />
          {trial.matchedIndications.map((i) => (
            <span key={i} className="text-[10px] rounded-full bg-ink-muted/10 px-2 py-0.5 text-ink-secondary dark:text-ink-secondary-dark">
              {i}
            </span>
          ))}
          {trial.matchedCompounds.map((c) => (
            <span key={c} className="text-[10px] rounded-full bg-brand/10 text-brand dark:text-brand-dark px-2 py-0.5">
              {c}
            </span>
          ))}
        </div>

        <h1 className="text-lg font-semibold leading-snug">{trial.briefTitle}</h1>
        {trial.officialTitle && trial.officialTitle !== trial.briefTitle && (
          <p className="mt-1 text-xs text-ink-muted">{trial.officialTitle}</p>
        )}

        <a
          href={`https://clinicaltrials.gov/study/${trial.nctId}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-brand dark:text-brand-dark hover:underline"
        >
          {trial.nctId} on ClinicalTrials.gov ↗
        </a>

        <p className="mt-2 text-[11px] text-ink-muted">{statusMeta.description}</p>

        <div className="mt-5 border-t border-hairline dark:border-hairline-dark pt-4">
          <Row label="Study type" value={trial.studyType ?? "—"} />
          <Row
            label="Phase"
            value={trial.phases.length ? trial.phases.map((p) => p.replace("PHASE", "Phase ")).join(" / ") : "—"}
          />
          <Row
            label="Enrollment (N=)"
            value={
              trial.enrollmentCount != null
                ? `${trial.enrollmentCount}${trial.enrollmentType ? ` (${trial.enrollmentType.toLowerCase()})` : ""}`
                : "—"
            }
          />
          <Row label="Study start" value={fmtDate(trial.startDate)} />
          <Row label="Primary completion" value={fmtDate(trial.primaryCompletionDate)} />
          <Row label="Study completion" value={fmtDate(trial.completionDate)} />
          <Row label="Sponsor" value={trial.sponsorName ?? "—"} />
          <Row label="Locations" value={trial.locationsSummary ?? "—"} />
          <Row label="Conditions" value={trial.conditions.join(", ") || "—"} />
        </div>

        {trial.interventions && trial.interventions.length > 0 && (
          <div className="mt-5 border-t border-hairline dark:border-hairline-dark pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Interventions</h3>
            <ul className="space-y-1.5">
              {trial.interventions.map((iv, i) => (
                <li key={i} className="text-[13px]">
                  <span className="font-medium">{iv.name}</span>
                  {iv.type && <span className="text-ink-muted"> · {iv.type}</span>}
                  {iv.otherNames.length > 0 && (
                    <span className="text-ink-muted"> ({iv.otherNames.join(", ")})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {trial.briefSummary && (
          <div className="mt-5 border-t border-hairline dark:border-hairline-dark pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Summary</h3>
            <p className="text-[13px] leading-relaxed text-ink-secondary dark:text-ink-secondary-dark whitespace-pre-line">
              {trial.briefSummary}
            </p>
          </div>
        )}

        <div className="mt-5 border-t border-hairline dark:border-hairline-dark pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Change history</h3>
          {trial.changes.length === 0 ? (
            <p className="text-[12px] text-ink-muted">
              No changes detected yet — this is the first snapshot the dashboard has for this trial.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {trial.changes.map((c) => (
                <li key={c.id} className="text-[13px] border-l-2 border-brand/40 pl-3">
                  <div className="font-medium">{FIELD_LABELS[c.field] ?? c.field}</div>
                  <div className="text-ink-secondary dark:text-ink-secondary-dark">
                    {formatChangeValue(c.field, c.oldValue)} <span className="text-ink-muted">→</span>{" "}
                    {formatChangeValue(c.field, c.newValue)}
                  </div>
                  <div className="text-[10px] text-ink-muted mt-0.5">
                    {new Date(c.detectedAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-6 text-[10px] text-ink-muted">
          First seen {new Date(trial.firstSeenAt).toLocaleDateString()} · CT.gov last updated{" "}
          {trial.lastUpdatePosted ?? "—"}
        </p>
      </div>
    </section>
  );
}
