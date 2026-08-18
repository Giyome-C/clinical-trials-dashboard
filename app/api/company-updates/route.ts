import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/company-updates?scope=all|today|week&companies=Pfizer,Amgen&q=<search>&since=<ISO>
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "all";
  const companiesParam = searchParams.get("companies");
  const q = searchParams.get("q")?.trim();
  const since = searchParams.get("since");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const andGroups: any[] = [];

  if (companiesParam) {
    const names = companiesParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length > 0) {
      andGroups.push({ company: { name: { in: names } } });
    }
  }

  if ((scope === "today" || scope === "week") && since) {
    const sinceDate = new Date(since);
    if (!Number.isNaN(sinceDate.getTime())) {
      // Persistent view, same convention as trial tracking's New Today /
      // New this Week: membership is based on firstSeenAt (when *this
      // dashboard* recorded the item), not the source's own document date,
      // so an item stays in view for the whole day/week regardless of how
      // many refreshes run in between.
      andGroups.push({ firstSeenAt: { gte: sinceDate } });
    }
  }

  if (q) {
    andGroups.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { company: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = andGroups.length > 0 ? { AND: andGroups } : {};

  const updates = await prisma.companyUpdate.findMany({
    where,
    orderBy: [{ sourceDate: "desc" }, { firstSeenAt: "desc" }],
    include: { company: { select: { id: true, name: true, ticker: true } } },
    take: 500,
  });

  return NextResponse.json({ updates });
}
