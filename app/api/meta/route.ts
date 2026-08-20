import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import type { IndicationRow, CompoundRow, RefreshLogRow } from "@/lib/db-types";

export const dynamic = "force-dynamic";

// Sidebar counts (per indication / per compound, plus the Tracked Trials nav
// row counts) + last refresh info, fetched once on load and after every
// refresh.
//
// todaySince/weekSince are the client's own local-midnight boundaries (same
// values it sends to /api/trials?scope=today|week — see Dashboard.tsx's
// startOfToday/startOfRollingWeek) so these counts always match what you'd
// actually see if you clicked into that nav row.
export async function GET(req: NextRequest) {
  await ensureSeeded();

  const { searchParams } = new URL(req.url);
  const todaySince = searchParams.get("todaySince");
  const weekSince = searchParams.get("weekSince");
  const todaySinceDate = todaySince ? new Date(todaySince) : null;
  const weekSinceDate = weekSince ? new Date(weekSince) : null;

  // Same "belongs to this window" test as app/api/trials/route.ts's
  // scope=today|week branch — a trial counts if it's new or was updated
  // since the boundary, not just newly created.
  const sinceWhere = (d: Date) => ({
    OR: [{ firstSeenAt: { gte: d } }, { lastChangedAt: { gte: d } }],
  });

  const [indications, compounds, lastRefresh, totalTrials, newTodayCount, newWeekCount]: [
    IndicationRow[],
    CompoundRow[],
    RefreshLogRow | null,
    number,
    number,
    number,
  ] = await Promise.all([
    prisma.indication.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.compound.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.refreshLog.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.trial.count(),
    todaySinceDate && !Number.isNaN(todaySinceDate.getTime())
      ? prisma.trial.count({ where: sinceWhere(todaySinceDate) })
      : Promise.resolve(0),
    weekSinceDate && !Number.isNaN(weekSinceDate.getTime())
      ? prisma.trial.count({ where: sinceWhere(weekSinceDate) })
      : Promise.resolve(0),
  ]);

  const indicationCounts = await Promise.all(
    indications.map(async (ind) => ({
      ...ind,
      count: await prisma.trial.count({ where: { matchedIndications: { has: ind.name } } }),
      newCount: await prisma.trial.count({
        where: { matchedIndications: { has: ind.name }, isNewSinceLastRefresh: true },
      }),
    }))
  );

  const compoundCounts = await Promise.all(
    compounds.map(async (c) => ({
      ...c,
      count: await prisma.trial.count({ where: { matchedCompounds: { has: c.name } } }),
      newCount: await prisma.trial.count({
        where: { matchedCompounds: { has: c.name }, isNewSinceLastRefresh: true },
      }),
    }))
  );

  return NextResponse.json({
    indications: indicationCounts,
    compounds: compoundCounts,
    totalTrials,
    newTodayCount,
    newWeekCount,
    lastRefresh,
  });
}
