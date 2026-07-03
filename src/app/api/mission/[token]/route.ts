import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MIN_RESPONSE_LENGTH_FOR_ISSUE = 10;
const MAX_RESPONSE_LENGTH = 700;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json();
  const action = body.action as "confirm" | "unavailable" | "problem";
  const response = typeof body.response === "string" ? body.response.trim() : "";

  if (!["confirm", "unavailable", "problem"].includes(action)) {
    return NextResponse.json({ error: "Action mission invalide" }, { status: 400 });
  }
  if (response.length > MAX_RESPONSE_LENGTH) {
    return NextResponse.json({ error: `Message trop long (${MAX_RESPONSE_LENGTH} caractères maximum)` }, { status: 400 });
  }
  if ((action === "unavailable" || action === "problem") && response.length < MIN_RESPONSE_LENGTH_FOR_ISSUE) {
    return NextResponse.json({ error: "Expliquez brièvement la raison de votre réponse." }, { status: 400 });
  }

  const mission = await db.teacherMissionLink.findUnique({
    where: { token },
    include: { booking: { include: { client: true, teacher: true } }, teacher: true },
  });
  if (!mission) return NextResponse.json({ error: "Lien mission introuvable" }, { status: 404 });
  if (mission.expiresAt < new Date()) {
    await db.teacherMissionLink.update({ where: { id: mission.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ error: "Ce lien mission a expiré" }, { status: 410 });
  }
  if (["CONFIRMED", "UNAVAILABLE", "PROBLEM_REPORTED", "EXPIRED", "REPLACEMENT_RECOMMENDED"].includes(mission.status)) {
    return NextResponse.json({ error: "Cette mission a déjà reçu une réponse." }, { status: 409 });
  }

  const now = new Date();
  const teacherName = mission.teacher.professionalName || mission.teacher.fullName;
  if (action === "confirm") {
    await db.$transaction(async (tx) => {
      await tx.teacherMissionLink.update({
        where: { id: mission.id },
        data: { status: "CONFIRMED", confirmedAt: now, response },
      });
      await tx.teacherTask.updateMany({
        where: { teacherId: mission.teacherId, bookingId: mission.bookingId, type: "CONFIRM_AVAILABILITY" },
        data: { status: "CONFIRMED", completedAt: now },
      });
      if (["CONFIRMED", "PENDING_ADMIN_VALIDATION", "PAID"].includes(mission.booking.status)) {
        await tx.booking.update({
          where: { id: mission.bookingId },
          data: {
            status: "ASSIGNED",
            assignedAt: mission.booking.assignedAt ?? now,
          },
        });
      }
      await tx.teacherNotification.create({
        data: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          title: `Disponibilité confirmée - ${mission.booking.reference}`,
          message: `${teacherName} a confirmé sa disponibilité. Réponse: ${response || "Confirmation simple."}`,
          channel: "PRIVATE_LINK",
          sent: true,
          status: "CONFIRMED",
          readAt: now,
        },
      });
      await tx.notification.create({
        data: {
          userId: null,
          title: "Professeur confirmé",
          message: `${teacherName} a confirmé sa disponibilité pour ${mission.booking.reference}.`,
          type: "TEACHER_CONFIRMED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "CONFIRMED",
          priority: "IMPORTANT",
          bookingId: mission.bookingId,
          teacherId: mission.teacherId,
          sentAt: now,
          confirmedAt: now,
          response,
          link: `/admin/professeurs/${mission.teacherId}?tab=cours&bookingId=${mission.bookingId}`,
          actionLabel: "Ouvrir l'espace professeur",
        },
      });
      await tx.notification.create({
        data: {
          userId: mission.booking.clientId,
          title: "Professeur confirmé",
          message: `${teacherName} a confirmé sa disponibilité pour votre cours de ${mission.booking.subjectName}. Votre réservation ${mission.booking.reference} reste suivie par l'administration MonProf CI.`,
          type: "TEACHER_CONFIRMED",
          recipientType: "CLIENT",
          recipientName: mission.booking.client.name,
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId: mission.bookingId,
          teacherId: mission.teacherId,
          clientId: mission.booking.clientId,
          sentAt: now,
          link: `/client/reservations/${mission.bookingId}`,
          actionLabel: "Voir réservation",
        },
      });
      await tx.notification.updateMany({
        where: {
          bookingId: mission.bookingId,
          teacherId: mission.teacherId,
          status: { in: ["CREATED", "SENT", "RELAUNCHED"] },
          type: {
            in: [
              "TEACHER_REMINDER",
              "TEACHER_NOT_CONFIRMED",
              "REPLACEMENT_RECOMMENDED",
              "TEACHER_MISSION_LINK",
            ],
          },
        },
        data: {
          read: true,
          readAt: now,
          status: "CONFIRMED",
          confirmedAt: now,
          response: `Clôturé automatiquement : ${teacherName} a confirmé la mission.`,
        },
      });
      await tx.teacherNotification.updateMany({
        where: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          status: { in: ["DRAFT", "PENDING", "SENT"] },
          title: { contains: mission.booking.reference },
        },
        data: {
          status: "CONFIRMED",
          readAt: now,
        },
      });
      await tx.teacherTask.updateMany({
        where: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          type: "ADMIN_ACTION",
          status: { in: ["TODO", "SENT_TO_TEACHER", "LATE"] },
          title: { contains: "Remplacement recommandé" },
        },
        data: {
          status: "CANCELLED",
          completedAt: now,
        },
      });
      await tx.adminActionLog.create({
        data: {
          action: "Mission professeur confirmée",
          entityType: "TeacherMissionLink",
          entityId: mission.id,
          detail: `${teacherName} a confirmé la mission ${mission.booking.reference}${response ? `: ${response}` : "."}`,
          oldStatus: mission.status,
          newStatus: "CONFIRMED",
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  const status = action === "unavailable" ? "UNAVAILABLE" : "PROBLEM_REPORTED";
  await db.$transaction(async (tx) => {
    await tx.teacherMissionLink.update({
      where: { id: mission.id },
      data: {
        status,
        declinedAt: action === "unavailable" ? now : null,
        problemAt: action === "problem" ? now : null,
        response,
      },
    });
    await tx.teacherTask.updateMany({
      where: { teacherId: mission.teacherId, bookingId: mission.bookingId, type: "CONFIRM_AVAILABILITY" },
      data: { status: action === "unavailable" ? "NOT_DONE" : "LATE" },
    });
    const existingReplacementTask = await tx.teacherTask.findFirst({
      where: {
        bookingId: mission.bookingId,
        type: "ADMIN_ACTION",
        priority: "CRITICAL",
        status: { notIn: ["DONE", "CANCELLED"] },
        title: { contains: action === "unavailable" ? "Remplacer" : "problème" },
      },
    });
    if (!existingReplacementTask) {
      await tx.teacherTask.create({
        data: {
          teacherId: mission.teacherId,
          bookingId: mission.bookingId,
          type: "ADMIN_ACTION",
          title: action === "unavailable" ? "Remplacer le professeur indisponible" : "Traiter le problème signalé",
          description: `${teacherName} a répondu sur la mission ${mission.booking.reference}: ${response || status}. Remplacement recommandé.`,
          priority: "CRITICAL",
          status: "TODO",
          dueAt: now,
        },
      });
    }
    await tx.teacherNotification.create({
      data: {
        teacherId: mission.teacherId,
        bookingId: mission.bookingId,
        title: action === "unavailable" ? `Indisponibilité déclarée - ${mission.booking.reference}` : `Problème signalé - ${mission.booking.reference}`,
        message: response || status,
        channel: "PRIVATE_LINK",
        sent: true,
        status: "SENT",
        readAt: now,
      },
    });
    await tx.notification.create({
      data: {
        userId: null,
        title: action === "unavailable" ? "Professeur indisponible" : "Problème signalé par le professeur",
        message: `${teacherName} a répondu sur la mission ${mission.booking.reference}: ${response || status}. Remplacement recommandé.`,
        type: action === "unavailable" ? "REPLACEMENT_RECOMMENDED" : "TEACHER_PROBLEM",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "SENT",
        priority: "CRITICAL",
        bookingId: mission.bookingId,
        teacherId: mission.teacherId,
        sentAt: now,
        response,
        link: action === "unavailable"
          ? `/admin/reservations/${mission.bookingId}?action=replace`
          : `/admin/professeurs/${mission.teacherId}?tab=cours&bookingId=${mission.bookingId}`,
        actionLabel: action === "unavailable" ? "Remplacer le professeur" : "Traiter le problème",
        actionType: action === "unavailable" ? "REPLACE_TEACHER" : "HANDLE_TEACHER_PROBLEM",
      },
    });
    await tx.adminActionLog.create({
      data: {
        action: action === "unavailable" ? "Mission professeur refusée" : "Problème mission signalé",
        entityType: "TeacherMissionLink",
        entityId: mission.id,
        detail: `${teacherName} a répondu ${status} pour ${mission.booking.reference}${response ? `: ${response}` : "."}`,
        oldStatus: mission.status,
        newStatus: status,
      },
    });
  });
  return NextResponse.json({ ok: true });
}
