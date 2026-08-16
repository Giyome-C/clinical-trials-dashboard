import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/trials?scope=indication|compound|new|changed|all&value=<name>&q=<search>
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "all";
  const value = searchParams.get("value");
  const q = searchParams.get("q")?.trim();

  // Typed as `any` deliberately: Prisma's generated `Prisma.TrialWhereInput`
  // type isn't available until `prisma generate` has run against a real
  // database connection (e.g. on Vercel), so this avoids a hard dependency
  // on that generated type while still building a valid Prisma where clause.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (scope === "indication" && value) {
    where.matchedIndications = { has: value };
  } else if (scope === "compound" && value) {
    where.matchedCompounds = { has: value };
  } else if (scope === "new") {
    where.isNewSinceLastRefresh = true;
  } else if (scope === "changed") {
    where.changedInLastRefresh = true;
  }

  if (q) {
    where.OR = [
      { briefTitle: { contains: q, mode: "insensitive" } },
      { nctId: { contains: q, mode: "insensitive" } },
      { sponsorName: { contains: q, mode: "insensitive" } },
    ];
  }

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

  return NextResponse.json({ trials });
}
