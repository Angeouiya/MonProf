import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWebPushActor } from "@/lib/web-push-actor";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getWebPushActor();
  if (!actor) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  let notificationCount = 0;
  if (actor.kind === "TEACHER") {
    notificationCount = await db.teacherNotification.count({
      where: {
        teacherId: actor.teacherId,
        status: { in: ["DRAFT", "PENDING", "SENT", "FAILED"] },
      },
    });
  } else if (actor.kind === "ADMIN") {
    notificationCount = await db.notification.count({
      where: {
        recipientType: "ADMIN",
        read: false,
        priority: { in: ["IMPORTANT", "URGENT", "CRITICAL"] },
        OR: [{ userId: null }, { userId: actor.userId }],
      },
    });
  } else {
    notificationCount = await db.notification.count({
      where: {
        recipientType: "CLIENT",
        read: false,
        OR: [{ userId: actor.userId }, { clientId: actor.userId }],
      },
    });
  }

  return NextResponse.json(
    { notificationCount, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
