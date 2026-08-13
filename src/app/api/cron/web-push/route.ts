import { NextRequest, NextResponse } from "next/server";
import { flushWebPushOutbox } from "@/lib/web-push";
import { publishWebPushFlushEvent } from "@/lib/web-push-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!configuredSecret || authorization !== `Bearer ${configuredSecret}`) {
    return NextResponse.json(
      { error: "Cron non autorisé" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const startedAt = Date.now();
  const queued = await publishWebPushFlushEvent("cron_recovery", {
    limit: 500,
    idempotencyKey: `web-push-cron-${new Date().toISOString().slice(0, 16)}`,
  });
  const directFlush = await flushWebPushOutbox(500);

  console.log(JSON.stringify({
    level: "info",
    scope: "web-push-cron",
    message: "done",
    ms: Date.now() - startedAt,
    queued,
    directFlush,
  }));

  return NextResponse.json(
    { queued, directFlush },
    { headers: { "Cache-Control": "no-store" } },
  );
}
