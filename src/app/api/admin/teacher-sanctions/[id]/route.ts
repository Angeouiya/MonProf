import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { teacherSanctionTypeLabel } from "@/lib/teacher-discipline-labels";
import {
  hasActiveJekoPayoutReservationInTransaction,
  lockTeacherPayoutBalance,
} from "@/lib/teacher-payout-reservations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi("TEACHERS_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const action = typeof body.action === "string" ? body.action : "";
  const decisionNote = typeof body.decisionNote === "string" ? body.decisionNote.trim() : "";
  if (!["apply", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }
  if (decisionNote.length > 700) {
    return NextResponse.json({ error: "La justification admin ne doit pas dépasser 700 caractères." }, { status: 400 });
  }

  const sanction = await db.teacherSanction.findUnique({
    where: { id },
    include: { teacher: { select: { id: true, fullName: true, professionalName: true } } },
  });
  if (!sanction) return NextResponse.json({ error: "Sanction introuvable." }, { status: 404 });
  if (sanction.status !== "PENDING_VALIDATION") {
    return NextResponse.json({ error: "Cette sanction a déjà été traitée." }, { status: 409 });
  }
  if (sanction.financial && decisionNote.length < 10) {
    return NextResponse.json({ error: "Une sanction financière doit avoir une justification admin d'au moins 10 caractères." }, { status: 400 });
  }
  const nextStatus = action === "apply" ? "APPLIED" : "CANCELLED";

  try {
    await db.$transaction(async (tx) => {
      // Une sanction financière et un retrait DRAFT prennent toujours le
      // verrou professeur dans le même ordre avant toute relecture.
      if (sanction.financial) {
        await lockTeacherPayoutBalance(tx, sanction.teacherId);
      }

      const current = await tx.teacherSanction.findUnique({
        where: { id },
        include: {
          teacher: { select: { id: true, fullName: true, professionalName: true } },
          booking: { select: { id: true, reference: true, teacherNetAmount: true } },
        },
      });
      if (!current) throw new Error("SANCTION_NOT_FOUND");
      if (current.status !== "PENDING_VALIDATION") throw new Error("SANCTION_ALREADY_HANDLED");

      if (
        action === "apply"
        && current.financial
        && await hasActiveJekoPayoutReservationInTransaction(
          tx,
          current.teacherId,
          current.bookingId,
        )
      ) {
        throw new Error("JEKO_PAYOUT_DRAFT_ACTIVE");
      }

      const adjustment = current.financial && current.amount > 0
        ? await tx.teacherPaymentAdjustment.findFirst({
            where: {
              teacherId: current.teacherId,
              bookingId: current.bookingId,
              amount: current.amount,
              reason: current.reason,
              status: "PENDING",
            },
            orderBy: { createdAt: "desc" },
          })
        : null;

      if (action === "apply" && current.financial && current.booking) {
        const appliedOnBooking = await tx.teacherPaymentAdjustment.aggregate({
          where: {
            bookingId: current.booking.id,
            status: "APPLIED",
            ...(adjustment ? { id: { not: adjustment.id } } : {}),
          },
          _sum: { amount: true },
        });
        if ((appliedOnBooking._sum.amount ?? 0) + current.amount > current.booking.teacherNetAmount) {
          throw new Error("SANCTION_EXCEEDS_BOOKING_NET");
        }
      }

      const claimedSanction = await tx.teacherSanction.updateMany({
        where: { id, status: "PENDING_VALIDATION" },
        data: {
          status: nextStatus,
          validatedAt: action === "apply" ? new Date() : null,
        },
      });
      if (claimedSanction.count !== 1) throw new Error("SANCTION_ALREADY_HANDLED");

      if (current.financial && current.amount > 0) {
        if (adjustment) {
          const claimedAdjustment = await tx.teacherPaymentAdjustment.updateMany({
            where: { id: adjustment.id, status: "PENDING" },
            data: {
              status: action === "apply" ? "APPLIED" : "CANCELLED",
              decision: action === "apply"
                ? `Retenue validée manuellement par ${admin.name}. Justification: ${decisionNote}`
                : `Retenue annulée manuellement par ${admin.name}. Justification: ${decisionNote}`,
            },
          });
          if (claimedAdjustment.count !== 1) throw new Error("SANCTION_ADJUSTMENT_CHANGED");
        } else if (action === "apply") {
          await tx.teacherPaymentAdjustment.create({
            data: {
              teacherId: current.teacherId,
              bookingId: current.bookingId,
              amount: current.amount,
              reason: current.reason,
              decision: `Retenue créée et validée manuellement par ${admin.name} lors de la validation de sanction. Justification: ${decisionNote}`,
              status: "APPLIED",
            },
          });
        }
      }

      await tx.teacher.update({
        where: { id: current.teacherId },
        data: { lastActivityAt: new Date() },
      });

      await tx.teacherNotification.create({
        data: {
          teacherId: current.teacherId,
          bookingId: current.bookingId,
          title: action === "apply" ? "Sanction validée" : "Sanction annulée",
          message: [
            `Bonjour ${current.teacher.professionalName || current.teacher.fullName},`,
            "",
            action === "apply"
              ? "Une sanction a été validée par le service client."
              : "Une sanction en attente a été annulée par le service client.",
            `Motif : ${current.reason}`,
            current.financial ? `Montant de retenue : ${current.amount.toLocaleString("fr-FR")} FCFA` : "",
            current.financial ? `Décision service client : ${decisionNote}` : "",
          ].filter(Boolean).join("\n"),
          channel: "INTERNAL",
          sent: true,
          status: "SENT",
          sentById: admin.id,
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: action === "apply" ? "Sanction validée" : "Sanction annulée",
          entityType: "Teacher",
          entityId: current.teacherId,
          detail: `${teacherSanctionTypeLabel(current.type)} - ${current.reason}${current.financial ? ` (${current.amount} FCFA) - justification: ${decisionNote}` : decisionNote ? ` - note: ${decisionNote}` : ""}`,
          oldStatus: "PENDING_VALIDATION",
          newStatus: nextStatus,
        },
      });

      await tx.notification.create({
        data: {
          userId: null,
          title: action === "apply" ? "Sanction professeur validée" : "Sanction professeur annulée",
          message: `${current.teacher.professionalName || current.teacher.fullName} - ${current.reason}`,
          type: "SANCTION",
          recipientType: "ADMIN",
          priority: current.financial ? "IMPORTANT" : "NORMAL",
          link: `/admin/professeurs/${current.teacherId}?tab=discipline`,
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    const code = routeErrorCode(error);
    if (code === "SANCTION_NOT_FOUND" || code === "TEACHER_PAYOUT_LOCK_NOT_FOUND") {
      return NextResponse.json({ error: "Sanction ou professeur introuvable." }, { status: 404 });
    }
    if (code === "SANCTION_EXCEEDS_BOOKING_NET") {
      return NextResponse.json({
        error: "La retenue cumulée dépasserait le net professeur de la réservation.",
      }, { status: 400 });
    }
    if (code === "JEKO_PAYOUT_DRAFT_ACTIVE") {
      return NextResponse.json({
        error: "Une tentative Jèko est en cours sur ce solde. Confirmez ou annulez d'abord ce transfert avant d'appliquer la sanction financière.",
      }, { status: 409 });
    }
    if (["SANCTION_ALREADY_HANDLED", "SANCTION_ADJUSTMENT_CHANGED", "P2034"].includes(code)) {
      return NextResponse.json({
        error: "Cette sanction, sa retenue ou le solde professeur vient d'être modifié. Actualisez avant de recommencer.",
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
