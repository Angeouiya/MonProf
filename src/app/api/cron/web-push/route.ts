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
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  const incoming = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret") || "";
  if (!configuredSecret || incoming !== configuredSecret) {
    return NextResponse.json({ error: "Cron non autorisé" }, { status: 401 });
  }
  return NextResponse.json(await flushWebPushOutbox(100));
}
