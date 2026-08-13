import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { runCurrentActorWebPushTest } from "@/lib/web-push-test";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const admin = await requireAdminApi("COMMUNICATIONS_SEND");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const result = await runCurrentActorWebPushTest();
  return NextResponse.json(result, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
