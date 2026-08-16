import { prisma } from "./db";
import { ensureSeeded } from "./seed";
import {
  fetchStudiesByCondition,
  fetchStudiesByIntervention,
  parseStudy,
  ParsedTrial,
  RawStudy,
} from "./ctgov";
import { buildInterventionQuery } from "./compounds";
import type { IndicationRow, CompoundRow, TrialRow } from "./db-types";

// Fields we diff on every refresh (per Appendix 1 + the fields the user
// called out: Study start, Primary completion, Study completion, Enrollment
// estimated (N=), Study Type, Phase — plus overallStatus itself).
const TRACKED_FIELDS = [
  "overallStatus",
  "studyType",
  "startDate",
  "primaryCompletionDate",
  "completionDate",
  "enrollmentCount",
  "phases",
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

interface CollectedEntry {
  parsed: ParsedTrial;
  indications: Set<string>;
  compounds: Set<string>;
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function fieldsEqual(field: TrackedField, oldVal: unknown, newVal: unknown): boolean {
  if (field === "phases") {
    return arraysEqual((oldVal as string[]) ?? [], (newVal as string[]) ?? []);
  }
  return (oldVal ?? null) === (newVal ?? null);
}

function toStoredString(field: TrackedField, val: unknown): string | null {
  if (val == null) return null;
  if (field === "phases") return (val as string[]).join(", ") || null;
  return String(val);
}

// Runs indication/compound fetches with a small concurrency cap so we don't
// hammer clinicaltrials.gov or blow past the serverless function's time
// budget on the very first (backfill) run.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface RefreshResult {
  trialsScanned: number;
  changesFound: number;
  newTrials: number;
  errors: string[];
}

export async function runRefresh(): Promise<RefreshResult> {
  await ensureSeeded();

  const log = await prisma.refreshLog.create({ data: {} });
  const errors: string[] = [];

  try {
    const [indications, compounds]: [IndicationRow[], CompoundRow[]] = await Promise.all([
      prisma.indication.findMany(),
      prisma.compound.findMany(),
    ]);

    const collected = new Map<string, CollectedEntry>();

    function ingest(raws: RawStudy[], kind: "indication" | "compound", label: string) {
      for (const raw of raws) {
        const parsed = parseStudy(raw);
        if (!parsed) continue;
        const entry =
          collected.get(parsed.nctId) ??
          ({ parsed, indications: new Set(), compounds: new Set() } as CollectedEntry);
        entry.parsed = parsed; // keep freshest parse
        if (kind === "indication") entry.indications.add(label);
        else entry.compounds.add(label);
        collected.set(parsed.nctId, entry);
      }
    }

    await mapWithConcurrency(indications, 3, async (ind) => {
      try {
        const raws = await fetchStudiesByCondition(ind.searchTerm);
        ingest(raws, "indication", ind.name);
      } catch (e) {
        const msg = `Indication "${ind.name}" fetch failed: ${e instanceof Error ? e.message : String(e)}`;
        console.error(msg);
        errors.push(msg);
      }
    });

    await mapWithConcurrency(compounds, 4, async (comp) => {
      try {
        const query = buildInterventionQuery(comp.name, comp.aliases);
        const raws = await fetchStudiesByIntervention(query);
        ingest(raws, "compound", comp.name);
      } catch (e) {
        const msg = `Compound "${comp.name}" fetch failed: ${e instanceof Error ? e.message : String(e)}`;
        console.error(msg);
        errors.push(msg);
      }
    });

    const trialsScanned = collected.size;
    const nctIds = Array.from(collected.keys());

    const existingTrials: TrialRow[] = nctIds.length
      ? await prisma.trial.findMany({ where: { nctId: { in: nctIds } } })
      : [];
    const existingMap = new Map<string, TrialRow>(existingTrials.map((t) => [t.nctId, t]));

    // Clear last run's "new" / "changed" flags before setting this run's.
    await prisma.trial.updateMany({
      where: { OR: [{ isNewSinceLastRefresh: true }, { changedInLastRefresh: true }] },
      data: { isNewSinceLastRefresh: false, changedInLastRefresh: false },
    });

    let changesFound = 0;
    let newTrials = 0;
    const changeEventRows: {
      nctId: string;
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }[] = [];

    const entries = Array.from(collected.entries());

    await mapWithConcurrency(entries, 10, async ([nctId, entry]) => {
      const p = entry.parsed;
      const matchedIndications = Array.from(entry.indications);
      const matchedCompounds = Array.from(entry.compounds);
      const existing = existingMap.get(nctId);

      const sharedData = {
        briefTitle: p.briefTitle,
        officialTitle: p.officialTitle,
        overallStatus: p.overallStatus,
        studyType: p.studyType,
        phases: p.phases,
        enrollmentCount: p.enrollmentCount,
        enrollmentType: p.enrollmentType,
        startDate: p.startDate,
        primaryCompletionDate: p.primaryCompletionDate,
        completionDate: p.completionDate,
        lastUpdatePosted: p.lastUpdatePosted,
        sponsorName: p.sponsorName,
        conditions: p.conditions,
        interventions: p.interventions as unknown as object,
        locationsSummary: p.locationsSummary,
        briefSummary: p.briefSummary,
        raw: p as unknown as object,
      };

      if (!existing) {
        await prisma.trial.create({
          data: {
            nctId,
            ...sharedData,
            matchedIndications,
            matchedCompounds,
            isNewSinceLastRefresh: true,
            lastCheckedAt: new Date(),
          },
        });
        newTrials += 1;
        return;
      }

      const diffs: TrackedField[] = TRACKED_FIELDS.filter(
        (f) => !fieldsEqual(f, (existing as unknown as Record<string, unknown>)[f], (p as unknown as Record<string, unknown>)[f])
      );

      if (diffs.length > 0) {
        for (const field of diffs) {
          changeEventRows.push({
            nctId,
            field,
            oldValue: toStoredString(field, (existing as unknown as Record<string, unknown>)[field]),
            newValue: toStoredString(field, (p as unknown as Record<string, unknown>)[field]),
          });
        }
        changesFound += diffs.length;
      }

      await prisma.trial.update({
        where: { nctId },
        data: {
          ...sharedData,
          matchedIndications: Array.from(new Set([...existing.matchedIndications, ...matchedIndications])),
          matchedCompounds: Array.from(new Set([...existing.matchedCompounds, ...matchedCompounds])),
          lastCheckedAt: new Date(),
          changedInLastRefresh: diffs.length > 0,
          ...(diffs.length > 0 ? { lastChangedAt: new Date() } : {}),
        },
      });
    });

    if (changeEventRows.length > 0) {
      await prisma.changeEvent.createMany({ data: changeEventRows });
    }

    await prisma.refreshLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        status: errors.length > 0 && trialsScanned === 0 ? "error" : "success",
        trialsScanned,
        changesFound,
        newTrials,
        errorMessage: errors.length ? errors.join(" | ").slice(0, 2000) : null,
      },
    });

    return { trialsScanned, changesFound, newTrials, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.refreshLog.update({
      where: { id: log.id },
      data: { finishedAt: new Date(), status: "error", errorMessage: msg.slice(0, 2000) },
    });
    throw err;
  }
}
