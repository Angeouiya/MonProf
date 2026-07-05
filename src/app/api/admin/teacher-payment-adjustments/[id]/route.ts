import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";

const MAX_DECISION_NOTE_LENGTH = 700;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi();
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

  if (action === "apply" && adjustment.booking) {
    const appliedOnBooking = await db.teacherPaymentAdjustment.aggregate({
      where: {
        bookingId: adjustment.booking.id,
        status: "APPLIED",
        id: { not: adjustment.id },
      },
      _sum: { amount: true },
    });
    const totalAfterDecision = (appliedOnBooking._sum.amount ?? 0) + adjustment.amount;
    if (totalAfterDecision > adjustment.booking.teacherNetAmount) {
      return NextResponse.json({
        error: `La retenue dépasserait le net professeur de la réservation (${adjustment.booking.teacherNetAmount} FCFA).`,
      }, { status: 400 });
    }
  }

  const nextStatus = action === "apply" ? "APPLIED" : "CANCELLED";
  const teacherName = adjustment.teacher.professionalName || adjustment.teacher.fullName;
  const decision = [
    adjustment.decision,
    "",
    action === "apply"
      ? `Décision finale : retenue validée manuellement par ${admin.name}.`
      : `Décision finale : retenue annulée manuellement par ${admin.name}.`,
    `Justification : ${decisionNote}`,
  ].filter(Boolean).join("\n");

  await db.$transaction(async (tx) => {
    await tx.teacherPaymentAdjustment.update({
      where: { id: adjustment.id },
      data: { status: nextStatus, decision },
    });

    const matchingSanction = await tx.teacherSanction.findFirst({
      where: {
        teacherId: adjustment.teacherId,
        bookingId: adjustment.bookingId,
        amount: adjustment.amount,
        reason: adjustment.reason,
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
      where: { id: adjustment.teacherId },
      data: { lastActivityAt: new Date() },
    });

    await tx.teacherNotification.create({
      data: {
        teacherId: adjustment.teacherId,
        bookingId: adjustment.bookingId,
        title: nextStatus === "APPLIED" ? "Retenue financière validée" : "Retenue financière annulée",
        message: [
          `Bonjour ${teacherName},`,
          "",
          nextStatus === "APPLIED"
            ? "Une retenue financière a été validée manuellement par le service client."
            : "Une retenue financière en attente a été annulée par le service client.",
          `Motif : ${adjustment.reason}`,
          `Montant : ${adjustment.amount.toLocaleString("fr-FR")} FCFA`,
          adjustment.booking ? `Réservation : ${adjustment.booking.reference}` : "Portée : retenue globale",
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
        entityId: adjustment.teacherId,
        detail: `${teacherName} - ${adjustment.reason} - ${adjustment.amount} FCFA${adjustment.booking ? ` (${adjustment.booking.reference})` : ""}. Justification: ${decisionNote}`,
        oldStatus: "PENDING",
        newStatus: nextStatus,
      },
    });

    await tx.notification.create({
      data: {
        userId: null,
        title: nextStatus === "APPLIED" ? "Retenue professeur validée" : "Retenue professeur annulée",
        message: `${teacherName} - ${adjustment.amount.toLocaleString("fr-FR")} FCFA - ${adjustment.reason}`,
        type: "PAYMENT",
        recipientType: "ADMIN",
        priority: nextStatus === "APPLIED" ? "IMPORTANT" : "NORMAL",
        teacherId: adjustment.teacherId,
        bookingId: adjustment.bookingId,
        adminId: admin.id,
        link: `/admin/professeurs/${adjustment.teacherId}?tab=paiements`,
        actionLabel: "Voir comptabilité",
      },
    });
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
