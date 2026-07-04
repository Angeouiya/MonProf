import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeacherApi } from "@/lib/teacher-auth";

const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT", "CRITICAL"] as const;
const MAX_SUBJECT_LENGTH = 140;
const MAX_MESSAGE_LENGTH = 2500;

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]) {
  return typeof value === "string" && allowed.includes(value) ? value as T[number] : fallback;
}

export async function POST(req: NextRequest) {
  const teacher = await requireTeacherApi();
  if (!teacher) {
    return NextResponse.json({ error: "Accès professeur non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const bookingId = typeof body.bookingId === "string" && body.bookingId ? body.bookingId : null;
  const priority = oneOf(body.priority, PRIORITIES, "IMPORTANT");

  if (!subject || !message) {
    return NextResponse.json({ error: "Sujet et message requis." }, { status: 400 });
  }
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return NextResponse.json({ error: `Le sujet ne doit pas dépasser ${MAX_SUBJECT_LENGTH} caractères.` }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Le message ne doit pas dépasser ${MAX_MESSAGE_LENGTH} caractères.` }, { status: 400 });
  }

  const booking = bookingId
    ? await db.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, teacherId: true, reference: true, subjectName: true, levelName: true },
      })
    : null;

  if (bookingId && !booking) {
    return NextResponse.json({ error: "Réservation introuvable." }, { status: 404 });
  }
  if (booking && booking.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Cette réservation n'appartient pas à votre fiche professeur." }, { status: 400 });
  }

  const now = new Date();
  const teacherName = teacher.professionalName || teacher.fullName;
  const created = await db.$transaction(async (tx) => {
    const item = await tx.teacherAdminMessage.create({
      data: {
        teacherId: teacher.id,
        bookingId,
        sender: "TEACHER",
        subject,
        message,
        priority,
        status: "WAITING_ADMIN",
        readByTeacherAt: now,
      },
    });

    await tx.teacher.update({
      where: { id: teacher.id },
      data: { lastActivityAt: now },
    });

    await tx.notification.create({
      data: {
        userId: null,
        title: `Message professeur - ${subject}`,
        message: `${teacherName} a envoyé un message à l'administration${booking ? ` pour ${booking.reference}` : ""} : ${message}`,
        type: "TEACHER_ADMIN_MESSAGE",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "SENT",
        priority,
        bookingId,
        teacherId: teacher.id,
        sentAt: now,
        link: `/admin/professeurs/${teacher.id}?tab=messages&messageId=${item.id}`,
        actionLabel: "Répondre",
        actionType: "ANSWER_TEACHER_MESSAGE",
      },
    });

    await tx.adminActionLog.create({
      data: {
        action: "Message professeur reçu",
        entityType: "TeacherAdminMessage",
        entityId: item.id,
        detail: `${teacherName} a contacté l'administration${booking ? ` pour ${booking.reference}` : ""}. Sujet : ${subject}.`,
        newStatus: "WAITING_ADMIN",
      },
    });

    return item;
  });

  return NextResponse.json({ ok: true, id: created.id });
}

export async function PATCH(req: NextRequest) {
  const teacher = await requireTeacherApi();
  if (!teacher) {
    return NextResponse.json({ error: "Accès professeur non autorisé" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" && body.id ? body.id : null;
  const where = id
    ? { id, teacherId: teacher.id, sender: "ADMIN" as const, readByTeacherAt: null }
    : { teacherId: teacher.id, sender: "ADMIN" as const, readByTeacherAt: null };

  await db.teacherAdminMessage.updateMany({
    where,
    data: { readByTeacherAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
