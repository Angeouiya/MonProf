import { NextResponse } from "next/server";
import { recoverOpenCommunicationCampaigns } from "@/lib/communication-campaigns";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const result = await recoverOpenCommunicationCampaigns(10);
  console.log(JSON.stringify({
    level: "info",
    scope: "communication-campaign-cron",
    message: "done",
    ms: Date.now() - startedAt,
    result,
  }));

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${secret}`;
}
