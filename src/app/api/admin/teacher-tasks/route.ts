import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

const TASK_TYPES = [
  "CONTACT_CLIENT",
  "CONFIRM_AVAILABILITY",
  "GO_TO_COURSE",
  "SEND_ONLINE_LINK",
  "TEACH_COURSE",
  "REPORT_COURSE_DONE",
  "JUSTIFY_DELAY",
  "ANSWER_DISPUTE",
  "SEND_DOCUMENT",
  "CONFIRM_RESCHEDULE",
  "CONTACT_ADMIN",
  "ADMIN_ACTION",
] as const;

const TASK_PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT", "CRITICAL"] as const;
const TASK_STATUSES = [
  "TODO",
  "SENT_TO_TEACHER",
  "SEEN_BY_TEACHER",
  "CONFIRMED",
  "IN_PROGRESS",
  "DONE",
  "LATE",
  "NOT_DONE",
  "CANCELLED",
] as const;

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, fallback?: T[number]) {
  if (typeof value === "string" && allowed.includes(value)) return value as T[number];
  return fallback;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = await req.json();
  const teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
  const bookingId = typeof body.bookingId === "string" && body.bookingId ? body.bookingId : null;
  const type = oneOf(body.type, TASK_TYPES);
  const priority = oneOf(body.priority, TASK_PRIORITIES, "NORMAL");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const dueAt = typeof body.dueAt === "string" && body.dueAt ? new Date(body.dueAt) : null;

  if (!teacherId || !type || !title || !description) {
    return NextResponse.json({ error: "teacherId, type, title et description requis" }, { status: 400 });
  }
  if (title.length > 180 || description.length > 2000) {
    return NextResponse.json({ error: "Titre ou description trop long." }, { status: 400 });
  }
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    return NextResponse.json({ error: "Échéance invalide." }, { status: 400 });
  }

  const [teacher, booking] = await Promise.all([
    db.teacher.findUnique({ where: { id: teacherId } }),
    bookingId ? db.booking.findUnique({ where: { id: bookingId }, select: { id: true, teacherId: true, reference: true } }) : null,
  ]);
  if (!teacher) return NextResponse.json({ error: "Professeur introuvable" }, { status: 404 });
  if (bookingId && !booking) return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  if (booking && booking.teacherId !== teacherId) {
    return NextResponse.json({ error: "Cette réservation n'appartient pas à ce professeur." }, { status: 400 });
  }

  const task = await db.teacherTask.create({
    data: {
      teacherId,
      bookingId,
      type,
      title,
      description,
      priority,
      dueAt,
      createdById: admin.id,
    },
  });

  await db.teacher.update({
    where: { id: teacherId },
    data: { lastActivityAt: new Date() },
  });
  await db.adminActionLog.create({
    data: {
      adminId: admin.id,
      action: "Tâche professeur créée",
      entityType: "Teacher",
      entityId: teacherId,
      detail: booking ? `${booking.reference} - ${title} - ${description}` : `${title} - ${description}`,
    },
  });

  return NextResponse.json({ ok: true, id: task.id });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = await req.json();
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  const status = oneOf(body.status, TASK_STATUSES);
  const notifyTeacher = Boolean(body.notifyTeacher);
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!taskId || !status) {
    return NextResponse.json({ error: "taskId et statut requis." }, { status: 400 });
  }
  if (note.length > 1200) {
    return NextResponse.json({ error: "La note de suivi est trop longue." }, { status: 400 });
  }

  const task = await db.teacherTask.findUnique({
    where: { id: taskId },
    include: {
      teacher: { select: { id: true, fullName: true, professionalName: true } },
      booking: {
        select: {
          id: true,
          reference: true,
          client: { select: { name: true } },
          subjectName: true,
          levelName: true,
          preferredTime: true,
          scheduledDate: true,
          scheduledTime: true,
        },
      },
    },
  });
  if (!task) return NextResponse.json({ error: "Tâche introuvable." }, { status: 404 });

  const now = new Date();
  const teacherName = task.teacher.professionalName || task.teacher.fullName;
  const message = [
    `Bonjour ${teacherName},`,
    "",
    `Mise à jour de tâche : ${task.title}`,
    task.booking ? `Réservation : ${task.booking.reference}` : "",
    task.booking ? `Client : ${task.booking.client.name}` : "",
    task.booking ? `Cours : ${task.booking.subjectName} - ${task.booking.levelName}` : "",
    task.booking ? `Créneau : ${task.booking.scheduledDate ? task.booking.scheduledDate.toLocaleDateString("fr-FR") : "à confirmer"} ${task.booking.scheduledTime || task.booking.preferredTime || ""}`.trim() : "",
    `Statut : ${status}`,
    "",
    task.description,
    note ? `\nNote admin : ${note}` : "",
  ].filter(Boolean).join("\n");

  await db.$transaction(async (tx) => {
    await tx.teacherTask.update({
      where: { id: task.id },
      data: {
        status,
        completedAt: status === "DONE" ? now : null,
      },
    });
    await tx.teacher.update({
      where: { id: task.teacherId },
      data: { lastActivityAt: now },
    });
    if (notifyTeacher || status === "SENT_TO_TEACHER") {
      await tx.teacherNotification.create({
        data: {
          teacherId: task.teacherId,
          bookingId: task.bookingId,
          title: `Tâche professeur - ${task.title}`,
          message,
          channel: "WHATSAPP",
          sent: true,
          status: "SENT",
          sentById: admin.id,
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: `Tâche envoyée à ${teacherName}`,
          message,
          type: "TEACHER_TASK",
          recipientType: "TEACHER",
          recipientName: teacherName,
          channel: "WHATSAPP",
          status: "SENT",
          priority: task.priority,
          bookingId: task.bookingId,
          teacherId: task.teacherId,
          adminId: admin.id,
          sentAt: now,
          link: task.bookingId
            ? `/admin/professeurs/${task.teacherId}?tab=cours&bookingId=${task.bookingId}`
            : `/admin/professeurs/${task.teacherId}?tab=taches`,
          actionLabel: task.bookingId ? "Ouvrir l'espace professeur" : "Voir tâches",
        },
      });
    }
    await tx.adminActionLog.create({
      data: {
        adminId: admin.id,
        action: "Statut tâche professeur",
        entityType: "Teacher",
        entityId: task.teacherId,
        detail: `${admin.name} a passé la tâche "${task.title}" de ${task.status} à ${status}.${note ? ` Note: ${note}` : ""}`,
        oldStatus: task.status,
        newStatus: status,
      },
    });
  });

  return NextResponse.json({ ok: true, status });
}
