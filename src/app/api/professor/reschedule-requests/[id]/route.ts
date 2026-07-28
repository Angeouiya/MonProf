import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeacherApi } from "@/lib/teacher-auth";
import { syncBookingSessionAggregates } from "@/lib/booking-sessions";
import {
  isReschedulableBookingSessionStatus,
  resolveBookingScheduleSummary,
  resolveRescheduleSessionTarget,
  sessionMatchesRescheduleOrigin,
} from "@/lib/reschedule-session-target";

const MAX_RESPONSE_LENGTH = 700;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacherApi();
  if (!teacher) {
    return NextResponse.json({ error: "Remplacez d'abord le mot de passe temporaire transmis par le service client." }, { status: 403 });
  }
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
    let applied: boolean;
    try {
      applied = await db.$transaction(async (tx) => {
        // Le report peut augmenter le releasedAmount de la séance. Le faire
        // pendant qu'un transfert Jèko a figé ce montant rendrait impossible
        // sa finalisation locale après un succès externe. Cette lecture et la
        // mutation de la séance partagent donc le même niveau SERIALIZABLE que
        // la création du DRAFT de retrait.
        const activePayout = await tx.teacherPayoutRecord.findFirst({
          where: {
            teacherId: teacher.id,
            provider: "JEKO",
            status: "DRAFT",
            allocations: { some: { bookingId: request.bookingId } },
          },
          select: { id: true },
        });
        if (activePayout) throw new Error("JEKO_PAYOUT_DRAFT_ACTIVE");

        const claim = await tx.bookingRescheduleRequest.updateMany({
          where: { id: request.id, status: "AWAITING_TEACHER" },
          data: {
            status: "APPLIED",
            teacherResponse: response || "Nouveau créneau accepté par le professeur.",
            teacherRespondedAt: now,
            appliedAt: now,
          },
        });
        if (claim.count !== 1) return false;

        const sessions = await tx.bookingSession.findMany({
          where: { bookingId: request.bookingId },
          orderBy: { sequence: "asc" },
        });
        // Les nouvelles demandes portent l'identifiant immuable de la séance.
        // Le rapprochement par créneau ne subsiste que pour les lignes legacy
        // créées avant l'ajout de bookingSessionId et exige un match unique.
        const targetSession = resolveRescheduleSessionTarget(sessions, {
          bookingSessionId: request.bookingSessionId,
          oldScheduledDate: request.oldScheduledDate,
          oldScheduledTime: request.oldScheduledTime,
        });
        if (request.bookingSessionId && !targetSession) {
          throw new Error("RESCHEDULE_SESSION_LEDGER_MISSING");
        }
        if (
          sessions.length > 0
          && (
            !targetSession
            || targetSession.teacherId !== teacher.id
            || !isReschedulableBookingSessionStatus(targetSession.status)
            || !sessionMatchesRescheduleOrigin(targetSession, request.oldScheduledDate, request.oldScheduledTime)
          )
        ) {
          throw new Error("RESCHEDULE_SESSION_LEDGER_MISSING");
        }

        if (targetSession) {
          const released = Boolean(targetSession.releasedAt)
            || ["RELEASED", "PARTIALLY_PAID", "PAID"].includes(targetSession.status);
          const nextStatus = targetSession.status === "PAID" && request.feeTeacherAmount > 0
            ? "PARTIALLY_PAID"
            : targetSession.status;
          await tx.bookingSession.update({
            where: { id: targetSession.id },
            data: {
              scheduledDate: request.proposedDate,
              scheduledTime: request.proposedTime,
              proposedDate: null,
              proposedTime: null,
              teacherCourseAmount: { increment: request.feeTeacherAmount },
              teacherNetAmount: { increment: request.feeTeacherAmount },
              ...(released && request.feeTeacherAmount > 0
                ? { releasedAmount: { increment: request.feeTeacherAmount }, status: nextStatus }
                : {}),
            },
          });
          await tx.bookingSessionHistory.create({
            data: {
              bookingSessionId: targetSession.id,
              actorType: "TEACHER",
              actorId: teacher.id,
              action: "RESCHEDULE_ACCEPTED",
              fromStatus: targetSession.status,
              toStatus: nextStatus,
              detail: `Créneau ${oldSlot} remplacé par ${newSlot}. Part professeur du supplément intégrée au ledger de la séance : ${request.feeTeacherAmount} FCFA.`,
            },
          });
        }

        const scheduleSummary = resolveBookingScheduleSummary(sessions.map((session) => (
          targetSession && session.id === targetSession.id
            ? {
                ...session,
                scheduledDate: request.proposedDate,
                scheduledTime: request.proposedTime,
              }
            : session
        )));
        const bookingScheduledDate = scheduleSummary?.scheduledDate ?? request.proposedDate;
        const bookingScheduledTime = scheduleSummary?.scheduledTime ?? request.proposedTime;

        await tx.booking.update({
          where: { id: request.bookingId },
          data: {
            scheduledDate: bookingScheduledDate,
            startDate: bookingScheduledDate,
            scheduledTime: bookingScheduledTime,
            preferredTime: bookingScheduledTime,
            teacherPayoutAmount: { increment: request.feeTeacherAmount },
            ...(sessions.length === 0
              ? { teacherNetAmount: { increment: request.feeTeacherAmount } }
              : {}),
            totalTeacherReceives: { increment: request.feeTeacherAmount },
            commissionAmount: { increment: request.feePlatformAmount },
            message: `${request.booking.message ?? ""}\n\n[Créneau modifié]: ${oldSlot} -> ${newSlot}. ${request.reason ? `Motif client: ${request.reason}.` : ""}`.trim(),
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
        if (sessions.length > 0) {
          await syncBookingSessionAggregates(
            tx as unknown as Parameters<typeof syncBookingSessionAggregates>[0],
            request.bookingId,
          );
        }
        return true;
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      const code = errorCode(error);
      if (code === "JEKO_PAYOUT_DRAFT_ACTIVE") {
        return NextResponse.json({
          error: "Un retrait Jèko est en cours sur cette réservation. Attendez sa confirmation avant d'accepter le nouveau créneau.",
          code,
        }, { status: 409 });
      }
      if (code === "RESCHEDULE_SESSION_LEDGER_MISSING") {
        return NextResponse.json({
          error: "Le créneau d'origine ne correspond pas à une séance attribuée à votre profil. Aucun planning ni solde n'a été modifié.",
          code,
        }, { status: 409 });
      }
      if (code === "P2034") {
        return NextResponse.json({
          error: "Le solde professeur vient d'être modifié. Actualisez puis acceptez de nouveau le créneau.",
          code: "RESCHEDULE_PAYOUT_CONFLICT",
        }, { status: 409 });
      }
      throw error;
    }
    if (!applied) {
      return NextResponse.json({ error: "Cette demande vient d'être traitée depuis une autre fenêtre." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: "APPLIED" });
  }

  const rejected = await db.$transaction(async (tx) => {
    const claim = await tx.bookingRescheduleRequest.updateMany({
      where: { id: request.id, status: "AWAITING_TEACHER" },
      data: {
        status: request.feeAmount > 0 ? "REFUND_REQUIRED" : "TEACHER_REJECTED",
        teacherResponse: response,
        teacherRespondedAt: now,
      },
    });
    if (claim.count !== 1) return false;
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
    return true;
  });

  if (!rejected) {
    return NextResponse.json({ error: "Cette demande vient d'être traitée depuis une autre fenêtre." }, { status: 409 });
  }

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

function errorCode(error: unknown) {
  if (error && typeof error === "object") {
    if ("code" in error && typeof error.code === "string") return error.code;
    if ("message" in error && typeof error.message === "string") return error.message;
  }
  return "UNKNOWN";
}
