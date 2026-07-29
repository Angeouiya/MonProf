import { NextRequest, NextResponse } from "next/server";
import type { BookingSessionStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { PAID_CLIENT_TRANSACTION_STATUSES } from "@/lib/cancellation-policy";
import {
  prepareBookingSessionsForRefundInTransaction,
  BookingRefundWorkflowError,
} from "@/lib/booking-refund-finalization";
import { isBookingFinanciallyTerminal, isBookingRefundInProgressOrFinal } from "@/lib/booking-financial-state";
import { syncBookingSessionAggregates } from "@/lib/booking-sessions";
import { lockTeacherPayoutBalance } from "@/lib/teacher-payout-reservations";
import {
  hasRefundableClientFunds,
  hasVerifiedPayDunyaClientPayment,
} from "@/lib/payment-security";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("DISPUTES_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const { id } = await params;
  const dispute = await db.dispute.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          teacher: { select: { id: true, fullName: true, professionalName: true, phone: true, email: true } },
          client: { select: { id: true, name: true, phone: true, email: true } },
          transactions: { orderBy: { createdAt: "desc" } },
        },
      },
      openedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!dispute) return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });
  return NextResponse.json(dispute);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("DISPUTES_MANAGE");
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const action: string = body.action;
  const resolution: string | undefined = body.resolution;

  const dispute = await db.dispute.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          teacher: { select: { id: true, fullName: true, professionalName: true } },
          client: { select: { id: true, name: true } },
          transactions: { where: { type: "CLIENT_PAYMENT" }, orderBy: { createdAt: "desc" } },
        },
      },
    },
  });
  if (!dispute) return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });

  const adminUser = admin;
  const activeDispute = dispute;
  const now = new Date();
  const teacherName = activeDispute.booking.teacher.professionalName || activeDispute.booking.teacher.fullName;
  const decisionText = resolution?.trim() || activeDispute.resolution || "Décision enregistrée par le service client.";
  const verifiedClientPaymentExists = hasVerifiedPayDunyaClientPayment(activeDispute.booking);

  async function recordDecision(
    tx: Prisma.TransactionClient,
    label: string,
    status: string,
    clientMessage: string,
  ) {
    await tx.adminActionLog.create({
      data: {
        adminId: adminUser.id,
        action: label,
        entityType: "Dispute",
        entityId: activeDispute.id,
        detail: `${adminUser.name} a traité le litige ${activeDispute.booking.reference} (${activeDispute.reason}) concernant ${teacherName}. Décision : ${decisionText}`,
        oldStatus: activeDispute.status,
        newStatus: status,
      },
    });
    await tx.notification.create({
      data: {
        userId: activeDispute.booking.client.id,
        title: label,
        message: clientMessage,
        type: "DISPUTE_DECISION",
        recipientType: "CLIENT",
        recipientName: activeDispute.booking.client.name,
        channel: "INTERNAL",
        status: "SENT",
        priority: status === "REFUNDED" || label === "Remboursement à traiter" ? "IMPORTANT" : "NORMAL",
        bookingId: activeDispute.bookingId,
        teacherId: activeDispute.booking.teacherId,
        clientId: activeDispute.booking.client.id,
        adminId: adminUser.id,
        sentAt: now,
        link: `/client/reservations/${activeDispute.bookingId}`,
        actionLabel: "Voir la réservation",
      },
    });
    await tx.notification.create({
      data: {
        userId: null,
        title: label,
        message: `${label} pour ${activeDispute.booking.reference}. Professeur : ${teacherName}.`,
        type: "DISPUTE_DECISION",
        recipientType: "ADMIN",
        channel: "INTERNAL",
        status: "CONFIRMED",
        priority: "NORMAL",
        bookingId: activeDispute.bookingId,
        teacherId: activeDispute.booking.teacherId,
        clientId: activeDispute.booking.client.id,
        adminId: adminUser.id,
        sentAt: now,
        confirmedAt: now,
        read: true,
        readAt: now,
        link: `/admin/litiges/${activeDispute.id}`,
        actionLabel: "Voir litige",
      },
    });
  }

  async function settleSessionDispute(
    tx: Prisma.TransactionClient,
    input: { disputeStatus: "RESOLVED" | "REJECTED"; label: string; clientMessage: string },
  ) {
    const bookingSessionId = activeDispute.bookingSessionId;
    if (!bookingSessionId) {
      throw new BookingRefundWorkflowError("Séance de litige introuvable", 404, "DISPUTE_SESSION_NOT_FOUND");
    }
    const identity = await tx.bookingSession.findUnique({
      where: { id: bookingSessionId },
      select: { teacherId: true },
    });
    if (!identity) {
      throw new BookingRefundWorkflowError("Séance de litige introuvable", 404, "DISPUTE_SESSION_NOT_FOUND");
    }
    await lockTeacherPayoutBalance(tx, identity.teacherId);
    const current = await tx.bookingSession.findUnique({ where: { id: bookingSessionId } });
    if (!current || current.bookingId !== activeDispute.bookingId || current.teacherId !== identity.teacherId) {
      throw new BookingRefundWorkflowError(
        "L'affectation ou la comptabilité de la séance vient de changer.",
        409,
        "DISPUTE_SESSION_STATE_CONFLICT",
      );
    }
    const claimed = await tx.dispute.updateMany({
      where: {
        id: activeDispute.id,
        bookingSessionId,
        status: { in: ["OPEN", "INVESTIGATING"] },
        resolvedAt: null,
      },
      data: { status: input.disputeStatus, resolution: decisionText, resolvedAt: now },
    });
    if (claimed.count !== 1) {
      throw new BookingRefundWorkflowError(
        "Ce litige vient d'être traité depuis une autre fenêtre.",
        409,
        "DISPUTE_CONCURRENT_UPDATE",
      );
    }

    // Si le versement n'avait pas encore commencé, la décision admin
    // libère uniquement cette séance. Pour un DRAFT/PAID, open_dispute a
    // conservé le ledger : la clôture du dossier ne le réécrit pas.
    if (current.status === "DISPUTED") {
      const openingHistory = await tx.bookingSessionHistory.findFirst({
        where: {
          bookingSessionId: current.id,
          action: "DISPUTE_OPENED",
          toStatus: "DISPUTED",
        },
        orderBy: { createdAt: "desc" },
        select: { fromStatus: true },
      });
      const sourceStatus = openingHistory?.fromStatus ?? "";
      const restorableStatuses = new Set([
        "PLANNED",
        "TEACHER_CONFIRMED",
        "IN_PROGRESS",
        "AWAITING_CLIENT_CONFIRMATION",
        "RELEASED",
        "RESCHEDULE_PROPOSED",
        "REPLACEMENT_PROPOSED",
        "NEEDS_REPLACEMENT",
      ]);
      if (!restorableStatuses.has(sourceStatus)) {
        throw new BookingRefundWorkflowError(
          "L'état antérieur de la séance est introuvable. Un arbitrage manuel est requis.",
          409,
          "DISPUTE_SESSION_SOURCE_STATE_MISSING",
        );
      }
      const releaseFunds = ["AWAITING_CLIENT_CONFIRMATION", "RELEASED"].includes(sourceStatus);
      const nextStatus = releaseFunds ? "RELEASED" : sourceStatus;
      const released = await tx.bookingSession.updateMany({
        where: {
          id: current.id,
          bookingId: current.bookingId,
          teacherId: current.teacherId,
          status: "DISPUTED",
          paidAmount: current.paidAmount,
          releasedAmount: current.releasedAmount,
          retainedAmount: current.retainedAmount,
        },
        data: {
          status: nextStatus as BookingSessionStatus,
          ...(releaseFunds
            ? {
                releasedAt: current.releasedAt ?? now,
                releasedAmount: Math.max(current.releasedAmount, current.teacherNetAmount),
              }
            : {}),
        },
      });
      if (released.count !== 1) {
        throw new BookingRefundWorkflowError(
          "La comptabilité de la séance vient de changer.",
          409,
          "DISPUTE_SESSION_FINANCIAL_CONFLICT",
        );
      }
      await tx.bookingSessionHistory.create({
        data: {
          bookingSessionId: current.id,
          actorType: "ADMIN",
          actorId: adminUser.id,
          action: input.disputeStatus === "REJECTED" ? "SESSION_DISPUTE_REJECTED" : "SESSION_DISPUTE_RESOLVED",
          fromStatus: "DISPUTED",
          toStatus: nextStatus,
          detail: releaseFunds
            ? `${decisionText} Fonds de cette séance libérés après arbitrage.`
            : `${decisionText} Séance restaurée à son état antérieur (${sourceStatus}), sans libération financière.`,
        },
      });
      await syncBookingSessionAggregates(tx as any, current.bookingId);
    }
    await recordDecision(tx, input.label, input.disputeStatus, input.clientMessage);
  }

  try {
    if (action === "investigate" && activeDispute.status !== "OPEN") {
      return NextResponse.json({ error: "Seul un litige ouvert peut passer en investigation." }, { status: 409 });
    }
    if (["resolve", "refund", "reject"].includes(action) && !["OPEN", "INVESTIGATING"].includes(activeDispute.status)) {
      return NextResponse.json({ error: "Ce litige est déjà traité et ne peut pas recevoir une seconde décision." }, { status: 409 });
    }
    switch (action) {
      case "investigate":
        await db.$transaction(async (tx) => {
          const claimed = await tx.dispute.updateMany({
            where: { id, status: "OPEN", resolvedAt: null },
            data: { status: "INVESTIGATING", resolution: resolution ?? dispute.resolution },
          });
          if (claimed.count !== 1) {
            throw new BookingRefundWorkflowError(
              "Ce litige vient d'être traité depuis une autre fenêtre.",
              409,
              "DISPUTE_CONCURRENT_UPDATE",
            );
          }
          await recordDecision(
            tx,
            "Litige en investigation",
            "INVESTIGATING",
            `Bonjour ${dispute.booking.client.name}, votre litige sur la réservation ${dispute.booking.reference} est en cours d'investigation. Votre paiement reste sécurisé pendant le traitement.`,
          );
        }, { isolationLevel: "Serializable" });
        return NextResponse.json({ ok: true });
      case "resolve":
        if (activeDispute.bookingSessionId) {
          await db.$transaction(async (tx) => {
            await settleSessionDispute(tx, {
              disputeStatus: "RESOLVED",
              label: "Litige séance résolu",
              clientMessage: `Bonjour ${dispute.booking.client.name}, le litige lié à une séance de ${dispute.booking.reference} est clôturé. La décision enregistrée est disponible dans votre réservation.`,
            });
          }, { isolationLevel: "Serializable" });
          return NextResponse.json({ ok: true, sessionDispute: true });
        }
        if (isBookingFinanciallyTerminal(activeDispute.booking) || isBookingRefundInProgressOrFinal(activeDispute.booking)) {
          return NextResponse.json({ error: "Cette réservation a un état financier final ou un remboursement en cours. Elle ne peut plus être remise en paiement." }, { status: 409 });
        }
        if (!verifiedClientPaymentExists) {
          return NextResponse.json({
            error: "Impossible de libérer un paiement : aucun paiement client confirmé côté serveur n'existe pour cette réservation.",
          }, { status: 409 });
        }
        await db.$transaction(async (tx) => {
          const claimed = await tx.dispute.updateMany({
            where: { id, status: { in: ["OPEN", "INVESTIGATING"] }, resolvedAt: null },
            data: { status: "RESOLVED", resolution: decisionText, resolvedAt: now },
          });
          const restored = await tx.booking.updateMany({
            where: { id: dispute.bookingId, status: "DISPUTED", paymentStatus: "DISPUTED" },
            data: { status: "PAYMENT_TO_RELEASE", paymentStatus: "TO_PAY_TEACHER" },
          });
          if (claimed.count !== 1 || restored.count !== 1) {
            throw new BookingRefundWorkflowError("Le litige ou la réservation a changé. Un état final ne peut pas être rouvert.", 409, "DISPUTE_TERMINAL_STATE_CONFLICT");
          }
          await tx.transaction.updateMany({
            where: { bookingId: dispute.bookingId, type: "CLIENT_PAYMENT", status: "DISPUTED" },
            data: { status: "TO_PAY_TEACHER" },
          });
          await recordDecision(
            tx,
            "Litige résolu - paiement à libérer",
            "RESOLVED",
            `Bonjour ${dispute.booking.client.name}, votre litige sur ${dispute.booking.reference} est clôturé. Le service client a validé la suite du traitement selon la décision enregistrée.`,
          );
        }, { isolationLevel: "Serializable" });
        return NextResponse.json({ ok: true });
      case "refund": {
        if (activeDispute.bookingSessionId) {
          return NextResponse.json({
            error: "Le remboursement intégral d'un pack ne peut pas être déclenché depuis le litige d'une seule séance. Effectuez d'abord l'arbitrage et ouvrez, si nécessaire, une procédure financière explicite sur la réservation.",
            code: "SESSION_DISPUTE_FULL_REFUND_BLOCKED",
          }, { status: 409 });
        }
        if (!verifiedClientPaymentExists || !hasRefundableClientFunds(activeDispute.booking.paymentStatus)) {
          return NextResponse.json({
            error: "Impossible de rembourser : aucun paiement remboursable confirmé côté serveur n'existe pour cette réservation.",
          }, { status: 409 });
        }
        const pending = await db.$transaction(async (tx) => {
          await prepareBookingSessionsForRefundInTransaction(tx, {
            bookingId: activeDispute.bookingId,
            actorId: adminUser.id,
            actorType: "ADMIN",
            now,
          });
          const booking = await tx.booking.findUnique({
            where: { id: activeDispute.bookingId },
            include: { transactions: { where: { type: "CLIENT_PAYMENT" } } },
          });
          if (!booking) throw new BookingRefundWorkflowError("Réservation introuvable", 404, "BOOKING_NOT_FOUND");
          if (isBookingFinanciallyTerminal(booking) || isBookingRefundInProgressOrFinal(booking)) {
            throw new BookingRefundWorkflowError(
              "Cette réservation est déjà remboursée ou possède un remboursement en cours.",
              409,
              "BOOKING_REFUND_ALREADY_STARTED",
            );
          }
          const confirmedAmount = booking.transactions
            .filter((transaction) => PAID_CLIENT_TRANSACTION_STATUSES.includes(transaction.status as (typeof PAID_CLIENT_TRANSACTION_STATUSES)[number]))
            .reduce((sum, transaction) => sum + Math.max(0, transaction.amount), 0);
          const refundableAmount = Math.min(
            confirmedAmount,
            Math.max(0, (booking.totalClientPays || booking.totalPrice) - booking.paymentServiceFeeAmount),
          );
          if (refundableAmount <= 0) {
            throw new BookingRefundWorkflowError("Aucun montant client ne peut être remboursé.", 409, "NO_REFUNDABLE_CLIENT_AMOUNT");
          }
          const disputeClaimed = await tx.dispute.updateMany({
            where: { id: activeDispute.id, status: { in: ["OPEN", "INVESTIGATING"] }, resolvedAt: null },
            data: { status: "RESOLVED", resolution: decisionText, resolvedAt: now },
          });
          if (disputeClaimed.count !== 1) {
            throw new BookingRefundWorkflowError("Ce litige vient d'être traité depuis une autre fenêtre.", 409, "DISPUTE_CONCURRENT_UPDATE");
          }
          await tx.booking.update({
            where: { id: booking.id },
            data: { paymentStatus: "REFUND_PENDING", cancellationRefundAmount: refundableAmount },
          });
          await tx.transaction.updateMany({
            where: {
              bookingId: booking.id,
              type: "CLIENT_PAYMENT",
              status: { in: [...PAID_CLIENT_TRANSACTION_STATUSES] },
            },
            data: { status: "REFUND_PENDING" },
          });
          await recordDecision(
            tx,
            "Remboursement à traiter",
            "RESOLVED",
            `Bonjour ${dispute.booking.client.name}, un remboursement de ${refundableAmount.toLocaleString("fr-FR")} FCFA a été autorisé pour ${dispute.booking.reference}. Renseignez vos coordonnées de remboursement ; le statut final ne sera appliqué qu'après le dépôt et sa référence de preuve.`,
          );
          return { refundableAmount };
        }, { isolationLevel: "Serializable" });
        return NextResponse.json({ ok: true, refundPending: true, amount: pending.refundableAmount });
      }
      case "reject":
        if (activeDispute.bookingSessionId) {
          await db.$transaction(async (tx) => {
            await settleSessionDispute(tx, {
              disputeStatus: "REJECTED",
              label: "Litige séance rejeté",
              clientMessage: `Bonjour ${dispute.booking.client.name}, le litige lié à une séance de ${dispute.booking.reference} a été examiné et rejeté. La décision est disponible dans votre réservation.`,
            });
          }, { isolationLevel: "Serializable" });
          return NextResponse.json({ ok: true, sessionDispute: true });
        }
        if (isBookingFinanciallyTerminal(activeDispute.booking) || isBookingRefundInProgressOrFinal(activeDispute.booking)) {
          return NextResponse.json({ error: "Cette réservation a un état financier final ou un remboursement en cours. Elle ne peut plus être remise en paiement." }, { status: 409 });
        }
        if (!verifiedClientPaymentExists) {
          return NextResponse.json({
            error: "Impossible de libérer un paiement : aucun paiement client confirmé côté serveur n'existe pour cette réservation.",
          }, { status: 409 });
        }
        await db.$transaction(async (tx) => {
          const claimed = await tx.dispute.updateMany({
            where: { id, status: { in: ["OPEN", "INVESTIGATING"] }, resolvedAt: null },
            data: { status: "REJECTED", resolution: decisionText, resolvedAt: now },
          });
          const restored = await tx.booking.updateMany({
            where: { id: dispute.bookingId, status: "DISPUTED", paymentStatus: "DISPUTED" },
            data: { status: "PAYMENT_TO_RELEASE", paymentStatus: "TO_PAY_TEACHER" },
          });
          if (claimed.count !== 1 || restored.count !== 1) {
            throw new BookingRefundWorkflowError("Le litige ou la réservation a changé. Un état final ne peut pas être rouvert.", 409, "DISPUTE_TERMINAL_STATE_CONFLICT");
          }
          await tx.transaction.updateMany({
            where: { bookingId: dispute.bookingId, type: "CLIENT_PAYMENT", status: "DISPUTED" },
            data: { status: "TO_PAY_TEACHER" },
          });
          await recordDecision(
            tx,
            "Litige rejeté",
            "REJECTED",
            `Bonjour ${dispute.booking.client.name}, votre litige sur ${dispute.booking.reference} a été examiné et rejeté par le service client. La décision est disponible dans votre réservation.`,
          );
        }, { isolationLevel: "Serializable" });
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (e: any) {
    if (e instanceof BookingRefundWorkflowError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    if (action === "refund" && e?.code === "P2034") {
      return NextResponse.json({ error: "Le solde a changé pendant l'ouverture du remboursement. Rechargez puis réessayez.", code: "REFUND_BALANCE_CONFLICT" }, { status: 409 });
    }
    if (e?.code === "P2034") {
      return NextResponse.json({
        error: "Le litige ou la séance vient de changer depuis une autre fenêtre. Rechargez avant de recommencer.",
        code: "DISPUTE_SERIALIZATION_CONFLICT",
      }, { status: 409 });
    }
    console.error("admin/dispute PATCH error", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
