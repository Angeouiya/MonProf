import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user && (session.user as any).role === "ADMIN";
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const body = await req.json();
  const { teacherId, bookingId, channel, message, title } = body;
  if (!teacherId || !message) {
    return NextResponse.json({ error: "teacherId et message requis" }, { status: 400 });
  }
  const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher) return NextResponse.json({ error: "Professeur introuvable" }, { status: 404 });

  const notif = await db.teacherNotification.create({
    data: {
      teacherId,
      bookingId: bookingId || null,
      title: title || `Notification — ${channel || "SMS"}`,
      message,
      channel: channel || "SMS",
      sent: true,
    },
  });
  return NextResponse.json({ id: notif.id, ok: true });
}
