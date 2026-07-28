import { NextRequest, NextResponse } from "next/server";
import { flushPasswordEmailOutbox } from "@/lib/password-email-outbox";

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
    return NextResponse.json({ error: "Cron non autorisé" }, { status: 401 });
  }

  return NextResponse.json(await flushPasswordEmailOutbox({ limit: 10 }));
}
