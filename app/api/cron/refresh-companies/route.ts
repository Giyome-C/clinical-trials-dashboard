import { NextRequest, NextResponse } from "next/server";
import { runCompanyRefresh } from "@/lib/company-refresh";

// Called by Vercel Cron on the schedule in vercel.json. Same
// Authorization: Bearer ${CRON_SECRET} check as /api/cron/refresh (trials)
// — see that file's comment for why. Kept as its own cron entry (rather
// than folded into the trial refresh) so a slow SEC/openFDA round doesn't
// eat into the trial refresh's time budget, or vice versa.
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
    const result = await runCompanyRefresh();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
