import { NextRequest, NextResponse } from "next/server";
import { runNotificationScheduler } from "@/lib/notification-scheduler";
import { flushWebPushOutbox } from "@/lib/web-push";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return runCron(req);
}

export async function POST(req: NextRequest) {
  return runCron(req);
}

async function runCron(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  const authorization = req.headers.get("authorization");
  if (!configuredSecret || authorization !== `Bearer ${configuredSecret}`) {
    return NextResponse.json(
      { error: "Cron non autorisé" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await runNotificationScheduler({
    source: "cron",
    adminId: null,
    adminName: "Scheduler Compétence",
  });
  const webPush = await flushWebPushOutbox(100);

  return NextResponse.json(
    { ...result, webPush },
    { headers: { "Cache-Control": "no-store" } },
  );
}
