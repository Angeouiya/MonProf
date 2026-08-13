import { NextResponse } from "next/server";
import { runCurrentActorWebPushTest } from "@/lib/web-push-test";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const result = await runCurrentActorWebPushTest();
  return NextResponse.json(result, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
