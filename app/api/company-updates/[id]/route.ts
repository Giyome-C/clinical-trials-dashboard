import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchStockQuote } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// Fetches one update's full detail plus a live stock quote for its company
// (fetched on demand, not stored — see lib/yahoo.ts).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const update = await prisma.companyUpdate.findUnique({
    where: { id },
    include: { company: true },
  });

  if (!update) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const quote = update.company.ticker ? await fetchStockQuote(update.company.ticker).catch(() => null) : null;

  return NextResponse.json({ update, quote });
}
