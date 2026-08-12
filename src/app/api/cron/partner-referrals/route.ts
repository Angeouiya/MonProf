import { NextRequest, NextResponse } from "next/server";
import { expirePartnerReferrals } from "@/lib/partner-referrals";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const expiredCount = await expirePartnerReferrals();
  return NextResponse.json({ ok: true, expiredCount });
}
