import { NextRequest, NextResponse } from "next/server";
import { flushWebPushOutbox } from "@/lib/web-push";

export const dynamic = "force-dynamic";

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
  return NextResponse.json(
    await flushWebPushOutbox(100),
    { headers: { "Cache-Control": "no-store" } },
  );
}
