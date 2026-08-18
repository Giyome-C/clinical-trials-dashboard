import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runCompanyRefresh } from "@/lib/company-refresh";

// Manual "Refresh now" trigger for the Tracked Companies section. Same
// pattern as /api/refresh (trials): not secret-gated since it's the app's
// own UI calling it, but throttled against a stray double-click.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MIN_INTERVAL_MS = 60_000;

export async function POST() {
  const last = await prisma.companyRefreshLog.findFirst({ orderBy: { startedAt: "desc" } });
  if (last && Date.now() - new Date(last.startedAt).getTime() < MIN_INTERVAL_MS && last.status === "running") {
    return NextResponse.json(
      { ok: false, error: "A company refresh is already running. Try again shortly." },
      { status: 429 }
    );
  }

  try {
    const result = await runCompanyRefresh();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
