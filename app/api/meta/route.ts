import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import type { IndicationRow, CompoundRow, RefreshLogRow } from "@/lib/db-types";

export const dynamic = "force-dynamic";

// Sidebar counts (per indication / per compound) + last refresh info,
// fetched once on load and after every refresh.
export async function GET() {
  await ensureSeeded();

  const [indications, compounds, lastRefresh, totalTrials]: [
    IndicationRow[],
    CompoundRow[],
    RefreshLogRow | null,
    number,
  ] = await Promise.all([
    prisma.indication.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.compound.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.refreshLog.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.trial.count(),
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
    lastRefresh,
  });
}
