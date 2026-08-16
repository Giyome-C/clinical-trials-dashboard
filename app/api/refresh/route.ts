import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runRefresh } from "@/lib/refresh";

// Manual "Refresh now" button in the sidebar. Not secret-gated (it's the
// app's own UI calling it), but throttled so a stray double-click or an
// idle browser tab can't hammer clinicaltrials.gov.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MIN_INTERVAL_MS = 60_000;

export async function POST() {
  const last = await prisma.refreshLog.findFirst({ orderBy: { startedAt: "desc" } });
  if (last && Date.now() - new Date(last.startedAt).getTime() < MIN_INTERVAL_MS && last.status === "running") {
    return NextResponse.json(
      { ok: false, error: "A refresh is already running. Try again shortly." },
      { status: 429 }
    );
  }

  try {
    const result = await runRefresh();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
