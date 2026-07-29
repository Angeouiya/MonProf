import "server-only";

import { Prisma } from "@prisma/client";
import { PAID_CLIENT_TRANSACTION_STATUSES } from "@/lib/cancellation-policy";
import {
  buildBookingRefundLedgerReference,
  calculateRemainingBookingRefund,
  evaluateBookingRefundPayoutSafety,
  FINALIZED_BOOKING_REFUND_STATUSES,
  normalizeBookingRefundExternalReference,
} from "@/lib/booking-refund";
import { lockTeacherPayoutBalances } from "@/lib/teacher-payout-reservations";
import { hasRefundableClientFunds, hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";

export class BookingRefundWorkflowError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "BookingRefundWorkflowError";
  }
}

type FinalizeBookingRefundInput = {
  bookingId: string;
  externalReference: string;
  processedById: string;
  now: Date;
};

export async function assertBookingRefundPayoutSafetyInTransaction(
  tx: Prisma.TransactionClient,
  bookingId: string,
) {
  const identity = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      teacherId: true,
      sessions: { select: { teacherId: true } },
    },
  });
  if (!identity) {
    throw new BookingRefundWorkflowError("Réservation introuvable", 404, "BOOKING_NOT_FOUND");
  }
  // Une séance remplacée peut être payable à un autre professeur que
  // Booking.teacherId. Tous les soldes concernés partagent donc le même
  // ordre de verrouillage afin qu'aucun DRAFT Jèko ne puisse se glisser entre
  // le contrôle et la neutralisation des séances.
  const teacherIds = [...new Set([
    identity.teacherId,
    ...identity.sessions.map((session) => session.teacherId),
  ])].sort();
  await lockTeacherPayoutBalances(tx, teacherIds);

  const state = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      teacherId: true,
      status: true,
      teacherPaidAmount: true,
      cancellationPenaltyTeacherAmount: true,
      sessions: { orderBy: { sequence: "asc" } },
    },
  });
  if (!state) {
    throw new BookingRefundWorkflowError("Réservation introuvable", 404, "BOOKING_NOT_FOUND");
  }
  const revalidatedTeacherIds = [...new Set([
    state.teacherId,
    ...state.sessions.map((session) => session.teacherId),
  ])].sort();
  if (
    revalidatedTeacherIds.length !== teacherIds.length
    || revalidatedTeacherIds.some((teacherId, index) => teacherId !== teacherIds[index])
  ) {
    throw new BookingRefundWorkflowError(
      "L'affectation d'un professeur vient de changer. Rechargez avant de reprendre l'opération financière.",
      409,
      "BOOKING_TEACHER_LOCK_SET_CHANGED",
    );
  }
  const activePayouts = await tx.teacherPayoutRecord.findMany({
    where: { status: "DRAFT", allocations: { some: { bookingId } } },
    orderBy: { createdAt: "asc" },
    select: { reference: true },
  });
  const paidAllocations = await tx.teacherPayoutAllocation.findMany({
    where: { bookingId, payout: { status: "PAID" } },
    select: { bookingSessionId: true, amount: true },
  });
  const payoutSafety = evaluateBookingRefundPayoutSafety({
    bookingStatus: state.status,
    teacherPaidAmount: state.teacherPaidAmount,
    cancellationPenaltyTeacherAmount: state.cancellationPenaltyTeacherAmount,
    activePayoutReferences: activePayouts.map((payout) => payout.reference),
    sessions: state.sessions,
    paidAllocations,
  });
  if (!payoutSafety.safe) {
    throw new BookingRefundWorkflowError(payoutSafety.message, 409, payoutSafety.code);
  }
  return state;
}

export async function prepareBookingSessionsForRefundInTransaction(
  tx: Prisma.TransactionClient,
  input: { bookingId: string; actorId: string; actorType: "ADMIN" | "CLIENT"; now: Date },
) {
  const state = await assertBookingRefundPayoutSafetyInTransaction(tx, input.bookingId);
  for (const session of state.sessions) {
    if (["CANCELLED", "REFUNDED"].includes(session.status)) continue;
    const cancelled = await tx.bookingSession.updateMany({
      where: {
        id: session.id,
        bookingId: input.bookingId,
        teacherId: session.teacherId,
        status: session.status,
        paidAmount: session.paidAmount,
        releasedAmount: session.releasedAmount,
        retainedAmount: session.retainedAmount,
      },
      data: { status: "CANCELLED", cancelledAt: session.cancelledAt ?? input.now },
    });
    if (cancelled.count !== 1) {
      throw new BookingRefundWorkflowError(
        "La comptabilité d'une séance a changé pendant l'autorisation du remboursement.",
        409,
        "REFUND_SESSION_CONCURRENT_UPDATE",
      );
    }
    await tx.bookingSessionHistory.create({
      data: {
        bookingSessionId: session.id,
        actorType: input.actorType,
        actorId: input.actorId,
        action: "BOOKING_REFUND_AUTHORIZED",
        fromStatus: session.status,
        toStatus: "CANCELLED",
        detail: "Remboursement autorisé ; séance neutralisée avant tout nouveau versement professeur.",
      },
    });
  }
  return state;
}

/**
 * Unique finalization path for a booking refund. The teacher row is the common
 * mutex with Jèko payout creation. A DRAFT is never cancelled here because it
 * may already have reached the provider while remaining locally unconfirmed.
 */
export async function finalizeBookingRefundInTransaction(
  tx: Prisma.TransactionClient,
  input: FinalizeBookingRefundInput,
) {
  const externalReference = normalizeBookingRefundExternalReference(input.externalReference);
  if (externalReference.length < 3 || externalReference.length > 160) {
    throw new BookingRefundWorkflowError(
      "Saisissez une référence de dépôt valide (3 à 160 caractères).",
      400,
      "REFUND_EXTERNAL_REFERENCE_INVALID",
    );
  }
  await assertBookingRefundPayoutSafetyInTransaction(tx, input.bookingId);

  const snapshot = await tx.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      client: { select: { id: true, name: true } },
      transactions: {
        include: { refundedRescheduleRequest: { select: { id: true } } },
      },
      clientRefundRequests: {
        where: { status: { in: ["PENDING", "APPROVED"] } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      sessions: { orderBy: { sequence: "asc" } },
    },
  });
  if (!snapshot) {
    throw new BookingRefundWorkflowError("Réservation introuvable", 404, "BOOKING_NOT_FOUND");
  }
  const refundWorkflowStateAllowed = ["CANCELLED", "DISPUTED", "REFUNDED"].includes(snapshot.status)
    && ["REFUND_PENDING", "PARTIAL_REFUND_PENDING", "PARTIALLY_REFUNDED"].includes(snapshot.paymentStatus);
  if (!refundWorkflowStateAllowed) {
    throw new BookingRefundWorkflowError(
      "Cette réservation n'a pas de remboursement autorisé en attente.",
      409,
      "BOOKING_REFUND_NOT_AUTHORIZED",
    );
  }
  if (snapshot.cancellationRefundAmount <= 0) {
    throw new BookingRefundWorkflowError(
      "Le montant de remboursement autorisé est nul.",
      409,
      "BOOKING_REFUND_AMOUNT_NOT_AUTHORIZED",
    );
  }

  const refundRequest = snapshot.clientRefundRequests[0] ?? null;
  if (!refundRequest) {
    const paidRequest = await tx.clientRefundRequest.findFirst({
      where: { bookingId: snapshot.id, status: "PAID" },
      orderBy: { processedAt: "desc" },
      select: { reference: true, externalReference: true },
    });
    throw new BookingRefundWorkflowError(
      paidRequest
        ? `La demande ${paidRequest.reference} est déjà payée et ne peut pas être réutilisée.`
        : "Le client doit d'abord renseigner son moyen et son numéro de remboursement.",
      paidRequest ? 409 : 400,
      paidRequest ? "REFUND_REQUEST_ALREADY_PAID" : "REFUND_REQUEST_REQUIRED",
    );
  }
  if (!hasRefundableClientFunds(snapshot.paymentStatus) || !hasVerifiedPayDunyaClientPayment(snapshot)) {
    throw new BookingRefundWorkflowError(
      "Impossible de rembourser : aucun paiement confirmé côté serveur n'est rattaché à cette réservation.",
      409,
      "CLIENT_PAYMENT_NOT_REFUNDABLE",
    );
  }

  // Serialize the same operator receipt across distinct bookings. A plain
  // preflight query under Serializable is not enough to prevent write skew.
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${`booking-refund:${externalReference}`}))
  `);
  const duplicateReceipt = await tx.clientRefundRequest.findFirst({
    where: {
      id: { not: refundRequest.id },
      status: "PAID",
      externalReference,
    },
    select: { id: true },
  });
  if (duplicateReceipt) {
    throw new BookingRefundWorkflowError(
      "Cette référence de dépôt est déjà utilisée pour un autre remboursement.",
      409,
      "REFUND_REFERENCE_ALREADY_USED",
    );
  }

  const confirmedClientPaymentAmount = snapshot.transactions
    .filter((transaction) => transaction.type === "CLIENT_PAYMENT"
      && PAID_CLIENT_TRANSACTION_STATUSES.includes(transaction.status as (typeof PAID_CLIENT_TRANSACTION_STATUSES)[number]))
    .reduce((sum, transaction) => sum + Math.max(0, transaction.amount), 0);
  const finalizedRefundAmount = snapshot.transactions
    .filter((transaction) => transaction.type === "REFUND"
      && FINALIZED_BOOKING_REFUND_STATUSES.includes(transaction.status as (typeof FINALIZED_BOOKING_REFUND_STATUSES)[number])
      && !transaction.refundedRescheduleRequest)
    .reduce((sum, transaction) => sum + Math.max(0, transaction.amount), 0);
  const calculation = calculateRemainingBookingRefund({
    confirmedClientPaymentAmount,
    finalizedRefundAmount,
    cancellationRefundAmount: snapshot.cancellationRefundAmount,
    totalClientPays: snapshot.totalClientPays,
    totalPrice: snapshot.totalPrice,
    paymentServiceFeeAmount: snapshot.paymentServiceFeeAmount,
    requestAmount: refundRequest.amount,
  });
  if (calculation.refundAmount <= 0) {
    throw new BookingRefundWorkflowError(
      "Aucun montant ne reste remboursable pour cette réservation.",
      409,
      "NO_REMAINING_REFUND_AMOUNT",
    );
  }

  const claimed = await tx.clientRefundRequest.updateMany({
    where: {
      id: refundRequest.id,
      bookingId: snapshot.id,
      status: { in: ["PENDING", "APPROVED"] },
      processedAt: null,
    },
    data: {
      status: "PAID",
      processedAt: input.now,
      processedById: input.processedById,
      externalReference,
      amount: calculation.refundAmount,
    },
  });
  if (claimed.count !== 1) {
    throw new BookingRefundWorkflowError(
      "Cette demande vient d'être traitée depuis une autre fenêtre.",
      409,
      "REFUND_CONCURRENT_UPDATE",
    );
  }

  for (const session of snapshot.sessions) {
    if (session.status === "REFUNDED") continue;
    const neutralized = await tx.bookingSession.updateMany({
      where: {
        id: session.id,
        bookingId: snapshot.id,
        teacherId: session.teacherId,
        status: session.status,
        paidAmount: session.paidAmount,
        releasedAmount: session.releasedAmount,
        retainedAmount: session.retainedAmount,
      },
      // Preserve every financial amount as history. REFUNDED alone removes
      // the line from future payout eligibility.
      data: { status: "REFUNDED" },
    });
    if (neutralized.count !== 1) {
      throw new BookingRefundWorkflowError(
        "La comptabilité d'une séance a changé pendant le remboursement.",
        409,
        "REFUND_SESSION_CONCURRENT_UPDATE",
      );
    }
    await tx.bookingSessionHistory.create({
      data: {
        bookingSessionId: session.id,
        actorType: "ADMIN",
        actorId: input.processedById,
        action: "BOOKING_REFUND_FINALIZED",
        fromStatus: session.status,
        toStatus: "REFUNDED",
        detail: `Remboursement client finalisé sous la preuve ${externalReference}; montants historiques conservés.`,
      },
    });
  }

  await tx.booking.update({
    where: { id: snapshot.id },
    data: { status: "REFUNDED", paymentStatus: calculation.finalPaymentStatus },
  });
  await tx.dispute.updateMany({
    where: { bookingId: snapshot.id, status: { in: ["OPEN", "INVESTIGATING", "RESOLVED"] } },
    data: { status: "REFUNDED", resolvedAt: input.now },
  });
  await tx.transaction.updateMany({
    where: {
      bookingId: snapshot.id,
      type: "CLIENT_PAYMENT",
      status: { in: [...PAID_CLIENT_TRANSACTION_STATUSES] },
    },
    data: { status: calculation.finalPaymentStatus },
  });
  const refundTransaction = await tx.transaction.create({
    data: {
      reference: buildBookingRefundLedgerReference(refundRequest.id),
      bookingId: snapshot.id,
      teacherId: snapshot.teacherId,
      amount: calculation.refundAmount,
      commission: 0,
      teacherNet: 0,
      type: "REFUND",
      status: calculation.finalPaymentStatus,
      method: refundRequest.method ?? snapshot.paymentMethod,
      paidAt: input.now,
    },
  });

  return { snapshot, refundRequest, calculation, refundTransaction };
}
