import { NextRequest, NextResponse } from "next/server";
import { runRefresh } from "@/lib/refresh";

// Called by Vercel Cron on the schedule in vercel.json. Vercel automatically
// sends `Authorization: Bearer ${CRON_SECRET}` on cron-triggered requests
// when CRON_SECRET is set as a project env var, so this checks that header
// to make sure a random visitor can't trigger (and rate-limit-abuse) a
// refresh by hitting this URL directly.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
