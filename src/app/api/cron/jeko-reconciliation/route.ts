import { NextRequest, NextResponse } from "next/server";
import { runJekoReconciliationSweep } from "@/lib/jeko-reconciliation-sweeper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Cron non autorisé." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await runJekoReconciliationSweep();
    console.info("[jeko:reconciliation_sweep_completed]", {
      ok: result.ok,
      scanned: result.scanned,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      actions: result.actions,
    });
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rapprochement Jèko indisponible.";
    console.error("[jeko:reconciliation_sweep_failed]", { message });
    return NextResponse.json(
      { ok: false, error: "Rapprochement Jèko temporairement indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
