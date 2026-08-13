import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== "CLIENT") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const notification = await db.notification.findFirst({
    where: {
      id,
      recipientType: "CLIENT",
      deletedAt: null,
      OR: [{ userId: user.id }, { clientId: user.id }],
    },
    select: { id: true },
  });
  if (!notification) {
    return NextResponse.json({ error: "Notification introuvable." }, { status: 404 });
  }

  const now = new Date();
  await db.$transaction([
    db.notification.update({
      where: { id: notification.id },
      data: { deletedAt: now, read: true, readAt: now, status: "EXPIRED" },
    }),
    db.webPushOutbox.updateMany({
      where: {
        notificationId: notification.id,
        status: { in: ["PENDING", "PROCESSING", "FAILED", "PARTIAL"] },
      },
      data: { status: "DEAD", processedAt: now, lastError: "Notification supprimée par le client." },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
