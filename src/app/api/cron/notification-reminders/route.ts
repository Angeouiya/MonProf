import { NextRequest, NextResponse } from "next/server";
import { runNotificationScheduler } from "@/lib/notification-scheduler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return runCron(req);
}

export async function POST(req: NextRequest) {
  return runCron(req);
}

async function runCron(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-cron-secret") || "";
  const querySecret = req.nextUrl.searchParams.get("secret") || "";
  const incomingSecret = auth.startsWith("Bearer ")
    ? auth.slice("Bearer ".length).trim()
    : headerSecret || querySecret;

  if (!configuredSecret || incomingSecret !== configuredSecret) {
    return NextResponse.json({ error: "Cron non autorisé" }, { status: 401 });
  }

  const result = await runNotificationScheduler({
    source: "cron",
    adminId: null,
    adminName: "Scheduler Compétence",
  });

  return NextResponse.json(result);
}
