import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeacherApi } from "@/lib/teacher-auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacherApi();
  if (!teacher) {
    return NextResponse.json({ error: "Accès professeur non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const notification = await db.teacherNotification.findFirst({
    where: { id, teacherId: teacher.id, deletedAt: null },
    select: { id: true },
  });
  if (!notification) {
    return NextResponse.json({ error: "Notification introuvable." }, { status: 404 });
  }

  const now = new Date();
  await db.$transaction([
    db.teacherNotification.update({
      where: { id: notification.id },
      data: { deletedAt: now, status: "READ", readAt: now },
    }),
    db.webPushOutbox.updateMany({
      where: {
        teacherNotificationId: notification.id,
        status: { in: ["PENDING", "PROCESSING", "FAILED", "PARTIAL"] },
      },
      data: { status: "DEAD", processedAt: now, lastError: "Notification supprimée par le professeur." },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
