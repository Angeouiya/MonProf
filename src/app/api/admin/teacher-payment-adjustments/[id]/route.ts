import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import {
  hasActiveJekoPayoutReservationInTransaction,
  lockTeacherPayoutBalance,
} from "@/lib/teacher-payout-reservations";

const MAX_DECISION_NOTE_LENGTH = 700;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi("FINANCE_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const action = typeof body.action === "string" ? body.action : "";
  const decisionNote = typeof body.decisionNote === "string" ? body.decisionNote.trim() : "";

  if (!["apply", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }
  if (decisionNote.length < 10) {
    return NextResponse.json({ error: "La justification admin doit contenir au moins 10 caractères." }, { status: 400 });
  }
  if (decisionNote.length > MAX_DECISION_NOTE_LENGTH) {
    return NextResponse.json({ error: `La justification admin ne doit pas dépasser ${MAX_DECISION_NOTE_LENGTH} caractères.` }, { status: 400 });
  }

  const adjustment = await db.teacherPaymentAdjustment.findUnique({
    where: { id },
    include: {
      teacher: { select: { id: true, fullName: true, professionalName: true } },
      booking: { select: { id: true, reference: true, teacherNetAmount: true } },
    },
  });

  if (!adjustment) {
    return NextResponse.json({ error: "Retenue introuvable." }, { status: 404 });
  }
  if (adjustment.status !== "PENDING") {
    return NextResponse.json({ error: "Cette retenue a déjà été traitée." }, { status: 409 });
  }
  const nextStatus = action === "apply" ? "APPLIED" : "CANCELLED";
  try {
    await db.$transaction(async (tx) => {
      // Même premier verrou que la création d'un retrait DRAFT Jèko.
      await lockTeacherPayoutBalance(tx, adjustment.teacherId);

      const current = await tx.teacherPaymentAdjustment.findUnique({
        where: { id: adjustment.id },
        include: {
          teacher: { select: { id: true, fullName: true, professionalName: true } },
          booking: { select: { id: true, reference: true, teacherNetAmount: true } },
        },
      });
      if (!current) throw new Error("ADJUSTMENT_NOT_FOUND");
      if (current.status !== "PENDING") throw new Error("ADJUSTMENT_ALREADY_HANDLED");

      if (
        action === "apply"
        && await hasActiveJekoPayoutReservationInTransaction(
          tx,
          current.teacherId,
          current.bookingId,
        )
      ) {
        throw new Error("JEKO_PAYOUT_DRAFT_ACTIVE");
      }

      if (action === "apply" && current.booking) {
        const appliedOnBooking = await tx.teacherPaymentAdjustment.aggregate({
          where: {
            bookingId: current.booking.id,
            status: "APPLIED",
            id: { not: current.id },
          },
          _sum: { amount: true },
        });
        const totalAfterDecision = (appliedOnBooking._sum.amount ?? 0) + current.amount;
        if (totalAfterDecision > current.booking.teacherNetAmount) {
          throw new Error("ADJUSTMENT_EXCEEDS_BOOKING_NET");
        }
      }

      const teacherName = current.teacher.professionalName || current.teacher.fullName;
      const decision = [
        current.decision,
        "",
        action === "apply"
          ? `Décision finale : retenue validée manuellement par ${admin.name}.`
          : `Décision finale : retenue annulée manuellement par ${admin.name}.`,
        `Justification : ${decisionNote}`,
      ].filter(Boolean).join("\n");

      const claimed = await tx.teacherPaymentAdjustment.updateMany({
        where: { id: current.id, status: "PENDING" },
        data: { status: nextStatus, decision },
      });
      if (claimed.count !== 1) throw new Error("ADJUSTMENT_ALREADY_HANDLED");

      const matchingSanction = await tx.teacherSanction.findFirst({
        where: {
          teacherId: current.teacherId,
          bookingId: current.bookingId,
          amount: current.amount,
          reason: current.reason,
          financial: true,
          status: "PENDING_VALIDATION",
        },
        orderBy: { createdAt: "desc" },
      });

      if (matchingSanction) {
        await tx.teacherSanction.update({
          where: { id: matchingSanction.id },
          data: {
            status: nextStatus === "APPLIED" ? "APPLIED" : "CANCELLED",
            validatedAt: nextStatus === "APPLIED" ? new Date() : null,
          },
        });
      }

      await tx.teacher.update({
        where: { id: current.teacherId },
        data: { lastActivityAt: new Date() },
      });

      await tx.teacherNotification.create({
        data: {
          teacherId: current.teacherId,
          bookingId: current.bookingId,
          title: nextStatus === "APPLIED" ? "Retenue financière validée" : "Retenue financière annulée",
          message: [
            `Bonjour ${teacherName},`,
            "",
            nextStatus === "APPLIED"
              ? "Une retenue financière a été validée manuellement par le service client."
              : "Une retenue financière en attente a été annulée par le service client.",
            `Motif : ${current.reason}`,
            `Montant : ${current.amount.toLocaleString("fr-FR")} FCFA`,
            current.booking ? `Réservation : ${current.booking.reference}` : "Portée : retenue globale",
            `Décision service client : ${decisionNote}`,
          ].join("\n"),
          channel: "INTERNAL",
          sent: true,
          status: "SENT",
          sentById: admin.id,
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: nextStatus === "APPLIED" ? "Retenue professeur validée" : "Retenue professeur annulée",
          entityType: "Teacher",
          entityId: current.teacherId,
          detail: `${teacherName} - ${current.reason} - ${current.amount} FCFA${current.booking ? ` (${current.booking.reference})` : ""}. Justification: ${decisionNote}`,
          oldStatus: "PENDING",
          newStatus: nextStatus,
        },
      });

      await tx.notification.create({
        data: {
          userId: null,
          title: nextStatus === "APPLIED" ? "Retenue professeur validée" : "Retenue professeur annulée",
          message: `${teacherName} - ${current.amount.toLocaleString("fr-FR")} FCFA - ${current.reason}`,
          type: "PAYMENT",
          recipientType: "ADMIN",
          priority: nextStatus === "APPLIED" ? "IMPORTANT" : "NORMAL",
          teacherId: current.teacherId,
          bookingId: current.bookingId,
          adminId: admin.id,
          link: `/admin/professeurs/${current.teacherId}?tab=paiements`,
          actionLabel: "Voir comptabilité",
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    const code = routeErrorCode(error);
    if (code === "ADJUSTMENT_NOT_FOUND" || code === "TEACHER_PAYOUT_LOCK_NOT_FOUND") {
      return NextResponse.json({ error: "Retenue ou professeur introuvable." }, { status: 404 });
    }
    if (code === "ADJUSTMENT_EXCEEDS_BOOKING_NET") {
      return NextResponse.json({
        error: `La retenue dépasserait le net professeur de la réservation (${adjustment.booking?.teacherNetAmount ?? 0} FCFA).`,
      }, { status: 400 });
    }
    if (code === "JEKO_PAYOUT_DRAFT_ACTIVE") {
      return NextResponse.json({
        error: "Une tentative Jèko est en cours sur ce solde. Confirmez ou annulez d'abord ce transfert avant d'appliquer la retenue.",
      }, { status: 409 });
    }
    if (code === "ADJUSTMENT_ALREADY_HANDLED" || code === "P2034") {
      return NextResponse.json({
        error: "Cette retenue ou le solde professeur vient d'être modifié. Actualisez avant de recommencer.",
      }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}

function routeErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return error instanceof Error ? error.message : "UNKNOWN";
}
