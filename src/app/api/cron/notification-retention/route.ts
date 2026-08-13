import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return runRetention(request);
}

export async function POST(request: NextRequest) {
  return runRetention(request);
}

async function runRetention(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const now = new Date();
  const technicalCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [clientNotifications, teacherNotifications, finalOutbox] = await db.$transaction([
    db.notification.updateMany({
      where: {
        deletedAt: null,
        expiresAt: { lte: now },
      },
      data: {
        deletedAt: now,
        read: true,
        readAt: now,
        status: "EXPIRED",
      },
    }),
    db.teacherNotification.updateMany({
      where: {
        deletedAt: null,
        expiresAt: { lte: now },
      },
      data: {
        deletedAt: now,
        status: "READ",
        readAt: now,
      },
    }),
    db.webPushOutbox.deleteMany({
      where: {
        status: { in: ["SENT", "NO_SUBSCRIPTION", "DEAD"] },
        updatedAt: { lt: technicalCutoff },
      },
    }),
  ]);

  const payload = {
    ok: true,
    clientNotifications: clientNotifications.count,
    teacherNotifications: teacherNotifications.count,
    finalOutbox: finalOutbox.count,
    ranAt: now.toISOString(),
  };
  console.log(JSON.stringify({ level: "info", scope: "notification-retention", ...payload }));
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
