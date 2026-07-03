import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

const CLIENT_MESSAGE_TYPES = [
  "INFORMATION",
  "REMINDER",
  "WARNING",
  "TEACHER_CHANGE",
  "RESCHEDULE",
  "PAYMENT",
  "DISPUTE",
  "COURSE_CONFIRMATION",
] as const;

const CLIENT_CHANNELS = ["INTERNAL", "SMS", "WHATSAPP", "EMAIL", "BROWSER", "PWA"] as const;
const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT", "CRITICAL"] as const;

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, fallback?: T[number]) {
  if (typeof value === "string" && allowed.includes(value)) return value as T[number];
  return fallback;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = await req.json();
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const bookingId = typeof body.bookingId === "string" && body.bookingId ? body.bookingId : null;
  const type = oneOf(body.type, CLIENT_MESSAGE_TYPES);
  const channel = oneOf(body.channel, CLIENT_CHANNELS);
  const priority = oneOf(body.priority, PRIORITIES, "NORMAL");
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!clientId || !type || !channel || !subject || !content) {
    return NextResponse.json({ error: "clientId, type, canal, objet et contenu requis" }, { status: 400 });
  }
  if (subject.length > 180) {
    return NextResponse.json({ error: "L'objet du message est trop long." }, { status: 400 });
  }
  if (content.length > 4000) {
    return NextResponse.json({ error: "Le message ne doit pas dépasser 4000 caractères." }, { status: 400 });
  }

  const [client, booking] = await Promise.all([
    db.user.findUnique({ where: { id: clientId }, select: { id: true, name: true, role: true } }),
    bookingId
      ? db.booking.findUnique({
          where: { id: bookingId },
          select: {
            id: true,
            reference: true,
            clientId: true,
            teacherId: true,
            subjectName: true,
            levelName: true,
            teacher: { select: { fullName: true, professionalName: true } },
          },
        })
      : null,
  ]);

  if (!client || client.role !== "CLIENT") {
    return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
  }
  if (bookingId && !booking) {
    return NextResponse.json({ error: "Réservation introuvable." }, { status: 404 });
  }
  if (booking && booking.clientId !== clientId) {
    return NextResponse.json({ error: "Cette réservation n'appartient pas à ce client." }, { status: 400 });
  }

  const communication = await db.clientCommunication.create({
    data: {
      clientId,
      bookingId,
      type,
      channel,
      subject,
      content,
      priority,
      status: "SENT",
      sentById: admin.id,
    },
  });

  await db.notification.create({
    data: {
      userId: clientId,
      title: subject,
      message: content,
      type,
      recipientType: "CLIENT",
      recipientName: client.name,
      channel,
      status: "SENT",
      priority,
      bookingId,
      teacherId: booking?.teacherId ?? null,
      clientId,
      adminId: admin.id,
      sentAt: new Date(),
      link: bookingId ? `/client/reservations/${bookingId}` : "/client/notifications",
      actionLabel: bookingId ? "Voir la réservation" : "Voir les notifications",
    },
  });

  await db.adminActionLog.create({
    data: {
      adminId: admin.id,
      action: "Message client envoyé",
      entityType: booking ? "Booking" : "User",
      entityId: booking?.id ?? clientId,
      detail: booking
        ? `${admin.name} a envoyé un message client sur ${booking.reference} (${booking.subjectName} - ${booking.levelName}). Type: ${type}.`
        : `${admin.name} a envoyé un message client à ${client.name}. Type: ${type}. Objet: ${subject}.`,
    },
  });

  return NextResponse.json({ ok: true, id: communication.id });
}
