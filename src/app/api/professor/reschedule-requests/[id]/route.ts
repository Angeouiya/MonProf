import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/teacher-auth";

const MAX_RESPONSE_LENGTH = 700;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { teacher } = await requireTeacher();
  const { id } = await params;
  const body = await req.json();
  const action = typeof body.action === "string" ? body.action : "";
  const response = typeof body.response === "string" ? body.response.trim().slice(0, MAX_RESPONSE_LENGTH) : "";

  if (!["accept", "reject"].includes(action)) {
    return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }
  if (action === "reject" && response.length < 5) {
    return NextResponse.json({ error: "Expliquez brièvement le refus du nouveau créneau." }, { status: 400 });
  }

  const request = await db.bookingRescheduleRequest.findUnique({
    where: { id },
    include: {
      transaction: true,
      booking: {
        include: {
          client: { select: { id: true, name: true } },
          teacher: { select: { id: true, fullName: true, professionalName: true } },
        },
      },
    },
  });

  if (!request || request.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  }
  if (request.status !== "AWAITING_TEACHER") {
    return NextResponse.json({ error: "Cette demande n'attend plus votre réponse." }, { status: 409 });
  }

  const now = new Date();
  const teacherName = teacher.professionalName || teacher.fullName;
  const clientName = request.booking.client.name;
  const oldSlot = `${formatDateFr(request.oldScheduledDate)} · ${request.oldScheduledTime || "horaire non renseigné"}`;
  const newSlot = `${formatDateFr(request.proposedDate)} · ${request.proposedTime}`;

  if (action === "accept") {
    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: request.bookingId },
        data: {
          scheduledDate: request.proposedDate,
          startDate: request.proposedDate,
          scheduledTime: request.proposedTime,
          preferredTime: request.proposedTime,
          teacherPayoutAmount: { increment: request.feeTeacherAmount },
          teacherNetAmount: { increment: request.feeTeacherAmount },
          totalTeacherReceives: { increment: request.feeTeacherAmount },
          commissionAmount: { increment: request.feePlatformAmount },
          message: `${request.booking.message ?? ""}\n\n[Créneau modifié]: ${oldSlot} -> ${newSlot}. ${request.reason ? `Motif client: ${request.reason}.` : ""}`.trim(),
        },
      });
      await tx.bookingRescheduleRequest.update({
        where: { id: request.id },
        data: {
          status: "APPLIED",
          teacherResponse: response || "Nouveau créneau accepté par le professeur.",
          teacherRespondedAt: now,
          appliedAt: now,
        },
      });
      await tx.teacherTask.updateMany({
        where: {
          teacherId: teacher.id,
          bookingId: request.bookingId,
          type: "CONFIRM_RESCHEDULE",
          status: { notIn: ["DONE", "CANCELLED"] },
        },
        data: { status: "DONE", completedAt: now },
      });
      await tx.notification.createMany({
        data: [
          {
            userId: request.clientId,
            title: "Nouveau créneau confirmé",
            message: `${teacherName} a confirmé votre nouveau créneau pour ${request.booking.reference}: ${newSlot}.`,
            type: "RESCHEDULE_CONFIRMED",
            recipientType: "CLIENT",
            recipientName: clientName,
            channel: "INTERNAL",
            status: "CONFIRMED",
            priority: "IMPORTANT",
            bookingId: request.bookingId,
            teacherId: teacher.id,
            clientId: request.clientId,
            sentAt: now,
            confirmedAt: now,
            link: `/client/reservations/${request.bookingId}`,
            actionLabel: "Voir réservation",
          },
          {
            userId: null,
            title: "Créneau modifié confirmé",
            message: `${teacherName} a accepté le nouveau créneau ${newSlot} pour ${request.booking.reference}. Supplément professeur: ${request.feeTeacherAmount.toLocaleString("fr-FR")} FCFA.`,
            type: "RESCHEDULE_CONFIRMED",
            recipientType: "ADMIN",
            channel: "INTERNAL",
            status: "CONFIRMED",
            priority: "IMPORTANT",
            bookingId: request.bookingId,
            teacherId: teacher.id,
            clientId: request.clientId,
            sentAt: now,
            confirmedAt: now,
            link: `/admin/reservations/${request.bookingId}`,
            actionLabel: "Voir réservation",
          },
        ],
      });
      await tx.teacherNotification.create({
        data: {
          teacherId: teacher.id,
          bookingId: request.bookingId,
          title: `Créneau confirmé - ${request.booking.reference}`,
          message: `Vous avez confirmé le nouveau créneau ${newSlot}.`,
          channel: "INTERNAL",
          sent: true,
          status: "CONFIRMED",
          readAt: now,
        },
      });
      await tx.adminActionLog.create({
        data: {
          adminId: null,
          action: "Modification créneau acceptée par professeur",
          entityType: "BookingRescheduleRequest",
          entityId: request.id,
          detail: `${teacherName} a accepté ${newSlot} pour ${request.booking.reference}. Ancien créneau: ${oldSlot}. Part professeur: ${request.feeTeacherAmount} FCFA.`,
          oldStatus: "AWAITING_TEACHER",
          newStatus: "APPLIED",
        },
      });
    });
    return NextResponse.json({ ok: true, status: "APPLIED" });
  }

  await db.$transaction(async (tx) => {
    await tx.bookingRescheduleRequest.update({
      where: { id: request.id },
      data: {
        status: request.feeAmount > 0 ? "REFUND_REQUIRED" : "TEACHER_REJECTED",
        teacherResponse: response,
        teacherRespondedAt: now,
      },
    });
    if (request.transaction) {
      await tx.transaction.update({
        where: { id: request.transaction.id },
        data: { status: "REFUND_PENDING" },
      });
    }
    await tx.teacherTask.updateMany({
      where: {
        teacherId: teacher.id,
        bookingId: request.bookingId,
        type: "CONFIRM_RESCHEDULE",
        status: { notIn: ["DONE", "CANCELLED"] },
      },
      data: { status: "NOT_DONE", completedAt: now },
    });
    await tx.notification.createMany({
      data: [
        {
          userId: request.clientId,
          title: "Nouveau créneau refusé",
          message: `${teacherName} ne peut pas assurer le nouveau créneau demandé pour ${request.booking.reference}. Le service client vous proposera une solution.${request.feeAmount > 0 ? " Le supplément payé passe en contrôle remboursement." : ""}`,
          type: "RESCHEDULE_REJECTED",
          recipientType: "CLIENT",
          recipientName: clientName,
          channel: "INTERNAL",
          status: "SENT",
          priority: "IMPORTANT",
          bookingId: request.bookingId,
          teacherId: teacher.id,
          clientId: request.clientId,
          sentAt: now,
          link: `/client/reservations/${request.bookingId}`,
          actionLabel: "Voir réservation",
        },
        {
          userId: null,
          title: request.feeAmount > 0 ? "Créneau refusé - supplément à traiter" : "Créneau refusé par professeur",
          message: `${teacherName} a refusé ${newSlot} pour ${request.booking.reference}. Motif: ${response}. ${request.feeAmount > 0 ? `Supplément à contrôler: ${request.totalToPay.toLocaleString("fr-FR")} FCFA.` : ""}`,
          type: request.feeAmount > 0 ? "RESCHEDULE_REFUND_REQUIRED" : "RESCHEDULE_REJECTED",
          recipientType: "ADMIN",
          channel: "INTERNAL",
          status: "SENT",
          priority: request.feeAmount > 0 ? "URGENT" : "IMPORTANT",
          bookingId: request.bookingId,
          teacherId: teacher.id,
          clientId: request.clientId,
          sentAt: now,
          link: `/admin/reservations/${request.bookingId}`,
          actionLabel: "Traiter le créneau",
        },
      ],
    });
    await tx.adminActionLog.create({
      data: {
        adminId: null,
        action: "Modification créneau refusée par professeur",
        entityType: "BookingRescheduleRequest",
        entityId: request.id,
        detail: `${teacherName} a refusé ${newSlot} pour ${request.booking.reference}. Motif: ${response}.`,
        oldStatus: "AWAITING_TEACHER",
        newStatus: request.feeAmount > 0 ? "REFUND_REQUIRED" : "TEACHER_REJECTED",
      },
    });
  });

  return NextResponse.json({ ok: true, status: request.feeAmount > 0 ? "REFUND_REQUIRED" : "TEACHER_REJECTED" });
}

function formatDateFr(date?: Date | string | null) {
  if (!date) return "À confirmer";
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "À confirmer";
  return parsed.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
