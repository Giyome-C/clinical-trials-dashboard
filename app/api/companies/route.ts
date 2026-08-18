import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureCompaniesSeeded } from "@/lib/seed";
import type { CompanyRow, CompanyRefreshLogRow } from "@/lib/db-types";

export const dynamic = "force-dynamic";

// Sidebar company checkboxes + counts, fetched once on load and after every
// company refresh.
export async function GET() {
  await ensureCompaniesSeeded();

  const [companies, lastRefresh, totalUpdates]: [CompanyRow[], CompanyRefreshLogRow | null, number] =
    await Promise.all([
      prisma.company.findMany({ orderBy: { name: "asc" } }),
      prisma.companyRefreshLog.findFirst({ orderBy: { startedAt: "desc" } }),
      prisma.companyUpdate.count(),
    ]);

  const withCounts = await Promise.all(
    companies.map(async (c) => ({
      ...c,
      count: await prisma.companyUpdate.count({ where: { companyId: c.id } }),
    }))
  );

  return NextResponse.json({ companies: withCounts, lastRefresh, totalUpdates });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  const ticker = body?.ticker?.trim() || null;
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  // No CIK lookup here — a manually added company gets SEC ingestion once
  // its cik is filled in (there's no reliable free ticker->CIK API call we
  // can make synchronously from this route without risking a bad match).
  const company = await prisma.company.upsert({
    where: { name },
    update: { ticker },
    create: { name, ticker, cik: null, fdaSponsorNames: [name], isDefault: false },
  });
  return NextResponse.json({ company });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  await prisma.company.deleteMany({ where: { name } });
  return NextResponse.json({ ok: true });
}
