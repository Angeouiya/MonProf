import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("COMMUNICATIONS_SEND");
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const notification = await db.notification.findUnique({ where: { id }, select: { id: true, title: true, status: true } });
  if (!notification) return NextResponse.json({ error: "Notification introuvable." }, { status: 404 });
  const now = new Date();
  await db.$transaction([
    db.notification.update({
      where: { id },
      data: { deletedAt: now, read: true, readAt: now, status: "EXPIRED" },
    }),
    db.webPushOutbox.updateMany({
      where: {
        notificationId: id,
        status: { in: ["PENDING", "PROCESSING", "FAILED", "PARTIAL"] },
      },
      data: { status: "DEAD", processedAt: now, lastError: "Notification masquée par l'administration." },
    }),
  ]);
  await db.adminActionLog.create({
    data: {
      adminId: admin.id,
      action: "Notification masquée",
      entityType: "Notification",
      entityId: id,
      detail: `${admin.name} a masqué la notification "${notification.title}".`,
      oldStatus: notification.status,
      newStatus: "EXPIRED",
    },
  });
  return NextResponse.json({ ok: true });
}
