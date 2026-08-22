// Sync pipeline endpoints — CLAUDE.md §7. Core logic lives in lib/sync.ts.
//  - GET  : cron entrypoint, guarded by CRON_SECRET.
//  - POST : in-app "Đồng bộ từ FPL" button. No secret (public app), lightly throttled.
// Both set maxDuration=300 so the ~18 FPL calls in runSync never time out — the
// default serverless budget (~10s) truncated the old server-action path, which
// is why the button appeared to "not update" gw_scores on Vercel.
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { runSync } from "@/lib/sync";
import { FPL_TAG } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runSync();
    revalidateTag(FPL_TAG);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[sync] failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

// Throttle spam clicks (per serverless instance, best-effort).
let lastRun = 0;
const MIN_INTERVAL_MS = 15_000;

export async function POST() {
  const now = Date.now();
  if (now - lastRun < MIN_INTERVAL_MS) {
    return NextResponse.json(
      { ok: false, error: "Vừa sync xong, thử lại sau vài giây." },
      { status: 429 },
    );
  }
  lastRun = now;

  try {
    const result = await runSync();
    // bust data cache (tag) + route/client router cache (path) so every tab
    // re-reads the freshly synced data.
    revalidateTag(FPL_TAG);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    lastRun = 0; // failed run shouldn't lock out a retry
    console.error("[sync:POST] failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
