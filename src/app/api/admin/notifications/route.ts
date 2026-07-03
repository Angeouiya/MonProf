import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminApi } from "@/lib/admin-api";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter"); // unread | all
  const where: any = { userId: null };
  if (filter === "unread") where.read = false;
  const items = await db.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const body = await req.json();
  const action = body.action as string | undefined;
  // body: { markAllRead?: true } ou { id, read: true }
  if (body.markAllRead) {
    await db.notification.updateMany({
      where: { userId: null, read: false },
      data: { read: true, readAt: new Date(), status: "SEEN" },
    });
    return NextResponse.json({ ok: true });
  }
  if (body.id && action) {
    const notification = await db.notification.findUnique({ where: { id: body.id } });
    if (!notification) return NextResponse.json({ error: "Notification introuvable" }, { status: 404 });

    if (action === "mark_treated") {
      await db.notification.update({
        where: { id: body.id },
        data: { read: true, readAt: new Date(), status: "CONFIRMED", confirmedAt: new Date(), response: body.response || "Traitée par l'administration." },
      });
      await db.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Notification traitée",
          entityType: "Notification",
          entityId: notification.id,
          detail: `${admin.name} a marqué la notification "${notification.title}" comme traitée.`,
          oldStatus: notification.status,
          newStatus: "CONFIRMED",
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "mark_failed") {
      await db.notification.update({
        where: { id: body.id },
        data: { status: "FAILED", response: body.response || "Échec marqué manuellement par l'administration." },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "relaunch_teacher") {
      if (notification.recipientType !== "TEACHER" || !notification.teacherId) {
        return NextResponse.json({ error: "Cette notification ne cible pas un professeur." }, { status: 400 });
      }
      await db.teacherNotification.create({
        data: {
          teacherId: notification.teacherId,
          bookingId: notification.bookingId || undefined,
          title: `Relance - ${notification.title}`,
          message: body.message || notification.message,
          channel: "WHATSAPP",
          sent: true,
          status: "SENT",
          sentById: admin.id,
        },
      });
      await db.notification.update({
        where: { id: body.id },
        data: { status: "RELAUNCHED", sentAt: new Date(), read: false, response: body.message || notification.message },
      });
      await db.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Notification professeur relancée",
          entityType: "Notification",
          entityId: notification.id,
          detail: `${admin.name} a relancé ${notification.recipientName || "le professeur"} via WhatsApp.`,
          oldStatus: notification.status,
          newStatus: "RELAUNCHED",
        },
      });
      return NextResponse.json({ ok: true });
    }
  }
  if (body.id) {
    await db.notification.update({
      where: { id: body.id },
      data: { read: !!body.read, readAt: body.read ? new Date() : null, status: body.read ? "SEEN" : "CREATED" },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
}
