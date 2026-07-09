import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT", "CRITICAL"] as const;
const STATUSES = ["OPEN", "WAITING_ADMIN", "WAITING_TEACHER", "RESOLVED", "CLOSED"] as const;
const MAX_SUBJECT_LENGTH = 140;
const MAX_MESSAGE_LENGTH = 2500;

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]) {
  return typeof value === "string" && allowed.includes(value) ? value as T[number] : fallback;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = await req.json();
  const teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
  const bookingId = typeof body.bookingId === "string" && body.bookingId ? body.bookingId : null;
  const replyToId = typeof body.replyToId === "string" && body.replyToId ? body.replyToId : null;
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const priority = oneOf(body.priority, PRIORITIES, "IMPORTANT");

  if (!teacherId || !subject || !message) {
    return NextResponse.json({ error: "Professeur, sujet et message requis." }, { status: 400 });
  }
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return NextResponse.json({ error: `Le sujet ne doit pas dépasser ${MAX_SUBJECT_LENGTH} caractères.` }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Le message ne doit pas dépasser ${MAX_MESSAGE_LENGTH} caractères.` }, { status: 400 });
  }

  const [teacher, booking, replyTo] = await db.$transaction(async (tx) => {
    const teacher = await tx.teacher.findUnique({ where: { id: teacherId }, select: { id: true, fullName: true, professionalName: true } });
    const booking = bookingId
      ? await tx.booking.findUnique({
          where: { id: bookingId },
          select: { id: true, teacherId: true, reference: true, subjectName: true, levelName: true },
        })
      : null;
    const replyTo = replyToId
      ? await tx.teacherAdminMessage.findUnique({
          where: { id: replyToId },
          select: { id: true, teacherId: true, bookingId: true, subject: true, status: true },
        })
      : null;
    return [teacher, booking, replyTo] as const;
  });

  if (!teacher) return NextResponse.json({ error: "Professeur introuvable." }, { status: 404 });
  if (bookingId && !booking) return NextResponse.json({ error: "Réservation introuvable." }, { status: 404 });
  if (booking && booking.teacherId !== teacherId) {
    return NextResponse.json({ error: "Cette réservation n'appartient pas à ce professeur." }, { status: 400 });
  }
  if (replyToId && !replyTo) return NextResponse.json({ error: "Message d'origine introuvable." }, { status: 404 });
  if (replyTo && replyTo.teacherId !== teacherId) {
    return NextResponse.json({ error: "Le message d'origine n'appartient pas à ce professeur." }, { status: 400 });
  }

  const now = new Date();
  const teacherName = teacher.professionalName || teacher.fullName;
  const created = await db.$transaction(async (tx) => {
    if (replyTo) {
      await tx.teacherAdminMessage.update({
        where: { id: replyTo.id },
        data: {
          status: "WAITING_TEACHER",
          readByAdminAt: now,
        },
      });
    }

    const item = await tx.teacherAdminMessage.create({
      data: {
        teacherId,
        bookingId: bookingId ?? replyTo?.bookingId ?? null,
        sender: "ADMIN",
        subject,
        message,
        priority,
        status: "WAITING_TEACHER",
        adminId: admin.id,
        readByAdminAt: now,
      },
    });

    await tx.teacherNotification.create({
      data: {
        teacherId,
        bookingId: bookingId ?? replyTo?.bookingId ?? null,
        title: `Message service client - ${subject}`,
        message,
        channel: "INTERNAL",
        sent: true,
        status: "SENT",
        sentById: admin.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: null,
        title: `Message envoyé au professeur - ${subject}`,
        message: `Le service client a répondu à ${teacherName} : ${message}`,
        type: "ADMIN_TEACHER_MESSAGE",
        recipientType: "TEACHER",
        recipientName: teacherName,
        channel: "INTERNAL",
        status: "SENT",
        priority,
        bookingId: bookingId ?? replyTo?.bookingId ?? null,
        teacherId,
        adminId: admin.id,
        sentAt: now,
        link: `/admin/professeurs/${teacherId}?tab=messages&messageId=${item.id}`,
        actionLabel: "Voir échange",
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Message service client au professeur",
        entityType: "TeacherAdminMessage",
        entityId: item.id,
        detail: `${admin.name} a envoyé un message à ${teacherName}${booking ? ` pour ${booking.reference}` : ""}. Sujet : ${subject}.`,
        oldStatus: replyTo?.status ?? null,
        newStatus: "WAITING_TEACHER",
      },
    });

    return item;
  });

  return NextResponse.json({ ok: true, id: created.id });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = await req.json();
  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "read";
  const explicitStatus = oneOf(body.status, STATUSES, "OPEN");

  if (!id) return NextResponse.json({ error: "Message requis." }, { status: 400 });

  const message = await db.teacherAdminMessage.findUnique({
    where: { id },
    include: { teacher: { select: { fullName: true, professionalName: true } } },
  });
  if (!message) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });

  const nextStatus = action === "resolve"
    ? "RESOLVED"
    : action === "close"
      ? "CLOSED"
      : action === "reopen"
        ? explicitStatus
        : message.status;
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.teacherAdminMessage.update({
      where: { id },
      data: {
        status: nextStatus,
        readByAdminAt: message.readByAdminAt ?? now,
        resolvedAt: ["RESOLVED", "CLOSED"].includes(nextStatus) ? now : null,
      },
    });

    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: action === "read" ? "Message professeur lu" : "Statut message professeur",
        entityType: "TeacherAdminMessage",
        entityId: id,
        detail: `${admin.name} a ${action === "read" ? "marqué comme lu" : `passé à ${nextStatus}`} le message "${message.subject}" de ${message.teacher.professionalName || message.teacher.fullName}.`,
        oldStatus: message.status,
        newStatus: nextStatus,
      },
    });
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
