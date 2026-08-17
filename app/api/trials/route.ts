import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { FIELD_LABELS, formatChangeValue } from "@/lib/statuses";

export const dynamic = "force-dynamic";

// GET /api/trials?scope=indication|compound|changed|today|week|all&value=<name>&q=<search>&since=<ISO>
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "all";
  const value = searchParams.get("value");
  const q = searchParams.get("q")?.trim();
  const since = searchParams.get("since");

  // Typed as `any` deliberately: Prisma's generated `Prisma.TrialWhereInput`
  // type isn't available until `prisma generate` has run against a real
  // database connection (e.g. on Vercel), so this avoids a hard dependency
  // on that generated type while still building a valid Prisma where clause.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const andGroups: any[] = [];

  if (scope === "indication" && value) {
    andGroups.push({ matchedIndications: { has: value } });
  } else if (scope === "compound" && value) {
    andGroups.push({ matchedCompounds: { has: value } });
  } else if (scope === "changed") {
    andGroups.push({ changedInLastRefresh: true });
  } else if ((scope === "today" || scope === "week") && since) {
    // Persistent views: a trial belongs here for the whole day/week window
    // regardless of how many refreshes have run since, so this checks
    // against the stored timestamps directly rather than the ephemeral
    // "this refresh only" flags.
    const sinceDate = new Date(since);
    if (!Number.isNaN(sinceDate.getTime())) {
      andGroups.push({
        OR: [{ firstSeenAt: { gte: sinceDate } }, { lastChangedAt: { gte: sinceDate } }],
      });
    }
  }

  if (q) {
    andGroups.push({
      OR: [
        { briefTitle: { contains: q, mode: "insensitive" } },
        { nctId: { contains: q, mode: "insensitive" } },
        { sponsorName: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = andGroups.length > 0 ? { AND: andGroups } : {};

  const trials = await prisma.trial.findMany({
    where,
    orderBy: [
      { changedInLastRefresh: "desc" },
      { isNewSinceLastRefresh: "desc" },
      { lastUpdatePosted: "desc" },
      { lastChangedAt: "desc" },
    ],
    select: {
      nctId: true,
      briefTitle: true,
      overallStatus: true,
      studyType: true,
      phases: true,
      enrollmentCount: true,
      sponsorName: true,
      matchedIndications: true,
      matchedCompounds: true,
      lastUpdatePosted: true,
      firstSeenAt: true,
      lastChangedAt: true,
      isNewSinceLastRefresh: true,
      changedInLastRefresh: true,
    },
    take: 500,
  });

  // Build a one-line "what changed" summary for every trial flagged as
  // changed in the most recent refresh, e.g. "Status: Recruiting →
  // Completed · Enrollment (N=): 40 → 120".
  const changedIds = trials.filter((t) => t.changedInLastRefresh).map((t) => t.nctId);
  const summaryByTrial = new Map<string, string>();

  if (changedIds.length > 0) {
    const changeRows = await prisma.changeEvent.findMany({
      where: { nctId: { in: changedIds } },
      orderBy: { detectedAt: "desc" },
    });

    // Group each trial's rows, keeping only the most recent batch (rows
    // sharing that trial's latest detectedAt) — that's "what changed in
    // this refresh", as opposed to older change history.
    const latestByTrial = new Map<string, typeof changeRows>();
    for (const row of changeRows) {
      const bucket = latestByTrial.get(row.nctId);
      if (!bucket) {
        latestByTrial.set(row.nctId, [row]);
      } else if (bucket[0].detectedAt.getTime() === row.detectedAt.getTime()) {
        bucket.push(row);
      }
    }

    for (const [nctId, rows] of latestByTrial) {
      const parts = rows.map(
        (r) => `${FIELD_LABELS[r.field] ?? r.field}: ${formatChangeValue(r.field, r.oldValue)} → ${formatChangeValue(r.field, r.newValue)}`
      );
      const summary =
        parts.length > 2 ? `${parts.slice(0, 2).join(" · ")} +${parts.length - 2} more` : parts.join(" · ");
      summaryByTrial.set(nctId, summary);
    }
  }

  const trialsWithSummary = trials.map((t) => ({
    ...t,
    changeSummary: summaryByTrial.get(t.nctId) ?? null,
  }));

  return NextResponse.json({ trials: trialsWithSummary });
}
