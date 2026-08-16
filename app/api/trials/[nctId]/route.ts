import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ nctId: string }> }) {
  const { nctId } = await params;
  const trial = await prisma.trial.findUnique({
    where: { nctId },
    include: {
      changes: { orderBy: { detectedAt: "desc" }, take: 100 },
    },
  });

  if (!trial) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ trial });
}
