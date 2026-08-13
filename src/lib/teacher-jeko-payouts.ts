import "server-only";

import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import {
  getTeacherGlobalRetentionLedger,
  getTeacherPayableAmount,
  isCancellationPenaltyPayout,
} from "@/lib/teacher-payments";
import { lockTeacherPayoutBalance } from "@/lib/teacher-payout-reservations";
import { buildTeacherPayoutSessionRetentionSnapshot } from "@/lib/teacher-payout-retention";
import { isBookingLevelPayoutEligible, isBookingSessionPayoutEligible } from "@/lib/booking-financial-state";
import {
  buildJekoPayoutRecordId,
  getStableJekoPayoutReference,
  processJekoTeacherPayoutRecord,
  type JekoPayoutReconciliationResult,
} from "@/lib/jeko-payout-reconciliation";

export type TeacherJekoPayoutActor =
  | { type: "TEACHER" }
  | { type: "ADMIN"; adminId: string; adminName: string };

export type CreateTeacherJekoPayoutInput = {
  teacherId: string;
  amount: number;
  method: PaymentMethod;
  paymentPhone: string;
  idempotencyKey: string;
  targetBookingId?: string | null;
  note?: string | null;
  operatorReference?: string | null;
  actor: TeacherJekoPayoutActor;
};

export class TeacherJekoPayoutError extends Error {
  readonly status: number;
  readonly code: string;
  readonly payoutRecordId?: string;

  constructor(
    message: string,
    status = 400,
    code = "TEACHER_JEKO_PAYOUT_ERROR",
    payoutRecordId?: string,
  ) {
    super(message);
    this.name = "TeacherJekoPayoutError";
    this.status = status;
    this.code = code;
    this.payoutRecordId = payoutRecordId;
  }
}

export async function createAndProcessTeacherJekoPayout(
  input: CreateTeacherJekoPayoutInput,
): Promise<JekoPayoutReconciliationResult> {
  const teacherId = input.teacherId.trim();
  const targetBookingId = input.targetBookingId?.trim() || null;
  const amount = Math.round(input.amount);
  const note = input.note?.trim() ?? "";
  const operatorReference = input.operatorReference?.trim() ?? "";
  const paymentPhone = input.paymentPhone.trim();

  if (!teacherId) throw new TeacherJekoPayoutError("Professeur requis.", 400, "TEACHER_REQUIRED");
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new TeacherJekoPayoutError("Montant de retrait invalide.", 400, "PAYOUT_AMOUNT_INVALID");
  }
  if (paymentPhone.length < 8 || paymentPhone.length > 20) {
    throw new TeacherJekoPayoutError("Numéro de retrait invalide.", 400, "PAYOUT_PHONE_INVALID");
  }

  let payoutRecordId: string;
  try {
    payoutRecordId = buildJekoPayoutRecordId(input.idempotencyKey);
  } catch (error) {
    throw new TeacherJekoPayoutError(
      error instanceof Error ? error.message : "Clé d'idempotence invalide.",
      400,
      "PAYOUT_IDEMPOTENCY_KEY_INVALID",
    );
  }
  const payoutReference = getStableJekoPayoutReference(payoutRecordId);

  const existingPayout = await db.teacherPayoutRecord.findUnique({ where: { id: payoutRecordId } });
  if (existingPayout) {
    if (!payoutRecordMatches(existingPayout, {
      teacherId,
      amount,
      method: input.method,
      paymentPhone,
      reference: payoutReference,
    })) {
      throw new TeacherJekoPayoutError(
        "Cette clé d'idempotence appartient à un autre retrait.",
        409,
        "PAYOUT_IDEMPOTENCY_MISMATCH",
      );
    }
    if (existingPayout.status === "CANCELLED") {
      throw new TeacherJekoPayoutError(
        "La tentative précédente a échoué sans débit. Relancez avec une nouvelle demande.",
        409,
        "PAYOUT_PREVIOUS_ATTEMPT_CANCELLED",
        existingPayout.id,
      );
    }
    return processJekoTeacherPayoutRecord(existingPayout.id);
  }

  const teacher = await db.teacher.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      fullName: true,
      professionalName: true,
      bookings: {
        where: {
          OR: [
            { paymentStatus: "TO_PAY_TEACHER" },
            { sessions: { some: { teacherId, status: { in: ["RELEASED", "PARTIALLY_PAID"] } } } },
            {
              status: { in: ["CANCELLED", "REFUNDED"] },
              paymentStatus: { in: ["PARTIALLY_REFUNDED", "RETAINED"] },
              cancellationPenaltyTeacherAmount: { gt: 0 },
            },
          ],
        },
        orderBy: [{ clientValidatedAt: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          reference: true,
          teacherNetAmount: true,
          teacherPaidAmount: true,
          teacherPaidAt: true,
          cancellationPenaltyTeacherAmount: true,
          cancellationPenaltyTeacherRate: true,
          cancellationPenaltyPlatformAmount: true,
          cancellationPenaltyPlatformRate: true,
          paymentStatus: true,
          paymentMethod: true,
          totalClientPays: true,
          totalPrice: true,
          paydunyaStatus: true,
          paydunyaVerifiedAt: true,
          paymentProvider: true,
          providerPaymentStatus: true,
          paymentVerifiedAt: true,
          status: true,
          transactions: {
            where: { type: "CLIENT_PAYMENT" },
            select: { type: true, status: true, amount: true },
          },
          sessions: {
            where: { teacherId, status: { in: ["RELEASED", "PARTIALLY_PAID", "PAID"] } },
            orderBy: [{ releasedAt: "asc" }, { sequence: "asc" }],
            select: {
              id: true,
              sequence: true,
              status: true,
              teacherNetAmount: true,
              releasedAmount: true,
              paidAmount: true,
              retainedAmount: true,
              releasedAt: true,
              paidAt: true,
              disputes: {
                where: { status: { in: ["OPEN", "INVESTIGATING"] } },
                select: { id: true },
              },
            },
          },
          _count: { select: { sessions: true } },
        },
      },
      paymentAdjustments: {
        where: { status: "APPLIED" },
        select: { id: true, amount: true, bookingId: true, status: true },
      },
    },
  });

  if (!teacher) {
    throw new TeacherJekoPayoutError("Professeur introuvable.", 404, "TEACHER_NOT_FOUND");
  }

  const [replacementBookings, historicalSessionRetentions, historicalLegacyRetentions] = await Promise.all([
    db.booking.findMany({
      where: {
        teacherId: { not: teacher.id },
        sessions: { some: { teacherId: teacher.id, status: { in: ["RELEASED", "PARTIALLY_PAID"] } } },
      },
      orderBy: [{ clientValidatedAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        reference: true,
        teacherNetAmount: true,
        teacherPaidAmount: true,
        teacherPaidAt: true,
        cancellationPenaltyTeacherAmount: true,
        cancellationPenaltyTeacherRate: true,
        cancellationPenaltyPlatformAmount: true,
        cancellationPenaltyPlatformRate: true,
        paymentStatus: true,
        paymentMethod: true,
        totalClientPays: true,
        totalPrice: true,
        paydunyaStatus: true,
        paydunyaVerifiedAt: true,
        paymentProvider: true,
        providerPaymentStatus: true,
        paymentVerifiedAt: true,
        status: true,
        transactions: {
          where: { type: "CLIENT_PAYMENT" },
          select: { type: true, status: true, amount: true },
        },
        sessions: {
          where: { teacherId: teacher.id, status: { in: ["RELEASED", "PARTIALLY_PAID", "PAID"] } },
          orderBy: [{ releasedAt: "asc" }, { sequence: "asc" }],
          select: {
            id: true,
            sequence: true,
            status: true,
            teacherNetAmount: true,
            releasedAmount: true,
            paidAmount: true,
            retainedAmount: true,
            releasedAt: true,
            paidAt: true,
            disputes: {
              where: { status: { in: ["OPEN", "INVESTIGATING"] } },
              select: { id: true },
            },
          },
        },
        _count: { select: { sessions: true } },
      },
    }),
    db.bookingSession.findMany({
      where: { teacherId: teacher.id, retainedAmount: { gt: 0 } },
      select: { bookingId: true, retainedAmount: true },
    }),
    db.teacherPayoutAllocation.findMany({
      where: {
        bookingSessionId: null,
        retainedAmountSnapshot: { gt: 0 },
        payout: {
          teacherId: teacher.id,
          status: { in: ["DRAFT", "PAID"] },
        },
      },
      select: { bookingId: true, retainedAmountSnapshot: true },
    }),
  ]);
  const teacherBookings = [...teacher.bookings, ...replacementBookings];

  const reservedDraftAllocations = await db.teacherPayoutAllocation.findMany({
    where: {
      payout: { teacherId: teacher.id, provider: "JEKO", status: "DRAFT" },
    },
    select: { bookingId: true, bookingSessionId: true, amount: true },
  });
  const reservedByItem = reservedDraftAllocations.reduce((map, allocation) => {
    const key = allocation.bookingSessionId ?? `booking:${allocation.bookingId}`;
    map.set(key, (map.get(key) ?? 0) + Math.max(0, allocation.amount));
    return map;
  }, new Map<string, number>());

  const globalRetentionLedger = getTeacherGlobalRetentionLedger(
    teacher.paymentAdjustments,
    historicalSessionRetentions,
    historicalLegacyRetentions,
  );
  let globalRetentionLeft = globalRetentionLedger.remaining;
  type PayoutBooking = (typeof teacherBookings)[number];
  type PayoutSession = PayoutBooking["sessions"][number];
  type DueItem = {
    booking: PayoutBooking;
    session: PayoutSession | null;
    payableAmount: number;
    paid: number;
    retainedAmountBefore: number;
    retainedAmountAfter: number;
    remaining: number;
  };
  const dueItems: DueItem[] = [];

  for (const booking of teacherBookings.filter((item) => hasVerifiedPayDunyaClientPayment(item))) {
    const cancellationPenaltyPayout = isCancellationPenaltyPayout(booking);
    if (booking._count.sessions > 0 && !cancellationPenaltyPayout) {
      if (booking.sessions.length === 0) continue;
      const persistedBookingRetention = booking.sessions.reduce(
        (sum, session) => sum + Math.max(0, session.retainedAmount),
        0,
      );
      let bookingRetentionLeft = Math.max(0, teacher.paymentAdjustments
        .filter((adjustment) => adjustment.bookingId === booking.id)
        .reduce((sum, adjustment) => sum + Math.max(0, adjustment.amount), 0) - persistedBookingRetention);

      for (const session of booking.sessions) {
        if (session.disputes.length > 0) continue;
        const payableAmount = Math.max(0, session.releasedAmount);
        const paid = Math.min(payableAmount, Math.max(0, session.paidAmount));
        const grossRemaining = Math.max(0, payableAmount - paid);
        const bookingRetention = Math.min(grossRemaining, bookingRetentionLeft);
        bookingRetentionLeft -= bookingRetention;
        const globalRetention = Math.min(Math.max(0, grossRemaining - bookingRetention), globalRetentionLeft);
        globalRetentionLeft -= globalRetention;
        const retentionSnapshot = buildTeacherPayoutSessionRetentionSnapshot({
          grossRemaining,
          persistedRetainedAmount: session.retainedAmount,
          additionalRetainedAmount: bookingRetention + globalRetention,
        });
        if (grossRemaining > 0 || retentionSnapshot.retainedAmountAfter > 0) {
          const reservedAmount = reservedByItem.get(session.id) ?? 0;
          dueItems.push({
            booking,
            session,
            payableAmount,
            paid,
            retainedAmountBefore: retentionSnapshot.retainedAmountBefore,
            retainedAmountAfter: retentionSnapshot.retainedAmountAfter,
            remaining: reservedAmount > 0 ? 0 : retentionSnapshot.remainingAfterRetention,
          });
        }
      }
      continue;
    }

    const payableAmount = getTeacherPayableAmount(booking);
    const paid = Math.min(payableAmount, Math.max(0, booking.teacherPaidAmount));
    const grossRemaining = Math.max(0, payableAmount - paid);
    const bookingRetention = teacher.paymentAdjustments
      .filter((adjustment) => adjustment.bookingId === booking.id)
      .reduce((sum, adjustment) => sum + Math.max(0, adjustment.amount), 0);
    const historicalGlobalRetention = globalRetentionLedger.legacyByBooking.get(booking.id) ?? 0;
    const globalRetention = Math.min(
      Math.max(0, grossRemaining - bookingRetention - historicalGlobalRetention),
      globalRetentionLeft,
    );
    globalRetentionLeft -= globalRetention;
    const retainedAmount = Math.min(
      grossRemaining,
      bookingRetention + historicalGlobalRetention + globalRetention,
    );
    if (grossRemaining > 0 || retainedAmount > 0) {
      const reservedAmount = reservedByItem.get(`booking:${booking.id}`) ?? 0;
      dueItems.push({
        booking,
        session: null,
        payableAmount,
        paid,
        retainedAmountBefore: retainedAmount,
        retainedAmountAfter: retainedAmount,
        remaining: reservedAmount > 0 ? 0 : Math.max(0, grossRemaining - retainedAmount),
      });
    }
  }

  const allocationCandidates = targetBookingId
    ? dueItems.filter((item) => item.booking.id === targetBookingId)
    : dueItems;
  const totalDue = allocationCandidates.reduce((sum, item) => sum + item.remaining, 0);

  if (targetBookingId && allocationCandidates.length === 0) {
    throw new TeacherJekoPayoutError(
      "Cette réservation n'est pas payable pour ce professeur ou n'a plus de reste dû.",
      400,
      "PAYOUT_BOOKING_NOT_PAYABLE",
    );
  }
  if (totalDue <= 0) {
    throw new TeacherJekoPayoutError(
      targetBookingId
        ? "Aucun reste net à retirer sur cette réservation après retenues appliquées."
        : "Aucun montant net à retirer pour ce professeur après retenues appliquées.",
      400,
      "PAYOUT_NO_BALANCE",
    );
  }
  if (amount > totalDue) {
    throw new TeacherJekoPayoutError(
      `Le montant dépasse le net disponible après retenues (${totalDue} FCFA).`,
      400,
      "PAYOUT_AMOUNT_EXCEEDS_BALANCE",
    );
  }

  let remainingPayment = amount;
  const allocations: { item: DueItem; amount: number }[] = [];
  for (const item of allocationCandidates) {
    if (remainingPayment <= 0) break;
    const allocated = Math.min(item.remaining, remainingPayment);
    if (allocated <= 0) continue;
    allocations.push({ item, amount: allocated });
    remainingPayment -= allocated;
  }

  const teacherName = teacher.professionalName || teacher.fullName;
  const actorLabel = input.actor.type === "ADMIN"
    ? `admin ${input.actor.adminName}`
    : "professeur";
  const draftNote = [
    note,
    operatorReference ? `[INTERNE] Référence opérateur : ${operatorReference}` : "",
    `[INTERNE] Retrait Jèko déclenché par le ${actorLabel}.`,
    "[INTERNE] Le ledger professeur ne sera débité qu'après confirmation finale Jèko.",
  ].filter(Boolean).join("\n");

  try {
    await db.$transaction(async (tx) => {
      await lockTeacherPayoutBalance(tx, teacher.id);

      const existing = await tx.teacherPayoutRecord.findUnique({ where: { id: payoutRecordId } });
      if (existing) {
        if (!payoutRecordMatches(existing, {
          teacherId: teacher.id,
          amount,
          method: input.method,
          paymentPhone,
          reference: payoutReference,
        })) {
          throw new Error("PAYOUT_IDEMPOTENCY_MISMATCH");
        }
        return existing;
      }

      const currentAppliedAdjustments = await tx.teacherPaymentAdjustment.findMany({
        where: { teacherId: teacher.id, status: "APPLIED" },
        select: { id: true, amount: true, bookingId: true, status: true },
      });
      if (
        appliedAdjustmentFingerprint(currentAppliedAdjustments)
        !== appliedAdjustmentFingerprint(teacher.paymentAdjustments)
      ) {
        throw new Error("PAYOUT_BALANCE_CHANGED");
      }

      const currentDrafts = await tx.teacherPayoutAllocation.findMany({
        where: {
          payout: { teacherId: teacher.id, provider: "JEKO", status: "DRAFT" },
          OR: allocations.map((allocation) => allocation.item.session
            ? { bookingSessionId: allocation.item.session.id }
            : { bookingId: allocation.item.booking.id, bookingSessionId: null }),
        },
        select: { bookingId: true, bookingSessionId: true, amount: true },
      });
      const currentReserved = currentDrafts.reduce((map, allocation) => {
        const key = allocation.bookingSessionId ?? `booking:${allocation.bookingId}`;
        map.set(key, (map.get(key) ?? 0) + allocation.amount);
        return map;
      }, new Map<string, number>());

      for (const allocation of allocations) {
        const item = allocation.item;
        const key = item.session?.id ?? `booking:${item.booking.id}`;
        if ((currentReserved.get(key) ?? 0) !== (reservedByItem.get(key) ?? 0)) {
          throw new Error("PAYOUT_BALANCE_CHANGED");
        }
        if (item.session) {
          const current = await tx.bookingSession.findUnique({
            where: { id: item.session.id },
            include: {
              booking: { select: { status: true, paymentStatus: true } },
              disputes: {
                where: { status: { in: ["OPEN", "INVESTIGATING"] } },
                select: { id: true },
              },
            },
          });
          if (
            !current
            || current.teacherId !== teacher.id
            || current.disputes.length > 0
            || !isBookingSessionPayoutEligible({
              status: current.booking.status,
              paymentStatus: current.booking.paymentStatus,
              sessionStatus: current.status,
            })
            || current.paidAmount !== item.session.paidAmount
            || current.releasedAmount !== item.session.releasedAmount
            || current.retainedAmount !== item.retainedAmountBefore
          ) {
            throw new Error("PAYOUT_BALANCE_CHANGED");
          }
          if (item.retainedAmountAfter !== item.retainedAmountBefore) {
            const retained = await tx.bookingSession.updateMany({
              where: {
                id: current.id,
                teacherId: teacher.id,
                paidAmount: current.paidAmount,
                releasedAmount: current.releasedAmount,
                retainedAmount: item.retainedAmountBefore,
              },
              data: { retainedAmount: item.retainedAmountAfter },
            });
            if (retained.count !== 1) throw new Error("PAYOUT_BALANCE_CHANGED");
          }
        } else {
          const current = await tx.booking.findUnique({
            where: { id: item.booking.id },
            select: {
              id: true,
              teacherId: true,
              status: true,
              paymentStatus: true,
              teacherNetAmount: true,
              teacherPaidAmount: true,
              cancellationPenaltyTeacherAmount: true,
            },
          });
          if (
            !current
            || current.teacherId !== teacher.id
            || !isBookingLevelPayoutEligible(current)
            || current.teacherPaidAmount !== item.paid
            || getTeacherPayableAmount(current) !== item.payableAmount
          ) {
            throw new Error("PAYOUT_BALANCE_CHANGED");
          }
        }
      }

      const record = await tx.teacherPayoutRecord.create({
        data: {
          id: payoutRecordId,
          reference: payoutReference,
          teacherId: teacher.id,
          amount,
          method: input.method,
          paymentPhone,
          provider: "JEKO",
          providerReference: payoutReference,
          transferFeeAmount: 0,
          transferFeeCoveredByPlatform: 0,
          note: draftNote || null,
          status: "DRAFT",
          createdById: input.actor.type === "ADMIN" ? input.actor.adminId : null,
          allocations: {
            create: allocations.map((allocation) => ({
              bookingId: allocation.item.booking.id,
              bookingSessionId: allocation.item.session?.id ?? null,
              amount: allocation.amount,
              paidAmountBefore: allocation.item.paid,
              releasedAmountSnapshot: allocation.item.payableAmount,
              retainedAmountSnapshot: allocation.item.retainedAmountAfter,
            })),
          },
        },
      });

      await tx.teacher.update({
        where: { id: teacher.id },
        data: {
          defaultPayoutMethod: input.method,
          defaultPayoutPhone: paymentPhone,
          lastActivityAt: new Date(),
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminId: input.actor.type === "ADMIN" ? input.actor.adminId : null,
          action: "Retrait professeur Jèko initié",
          entityType: "TeacherPayoutRecord",
          entityId: record.id,
          detail: `${teacherName} a lancé un retrait Jèko de ${amount} FCFA. Les ${allocations.length} allocation(s) sont réservées sans débit du ledger jusqu'à confirmation Jèko.`,
          oldStatus: "TO_PAY_TEACHER",
          newStatus: "DRAFT",
        },
      });
      return record;
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    const errorCode = getErrorCode(error);
    if ([
      "P2034",
      "PAYOUT_BALANCE_CHANGED",
      "TEACHER_PAYOUT_LOCK_NOT_FOUND",
    ].includes(errorCode)) {
      throw new TeacherJekoPayoutError(
        "Le solde vient d'être modifié par une autre action. Actualisez avant de relancer le retrait.",
        409,
        errorCode,
      );
    }
    if (errorCode === "PAYOUT_IDEMPOTENCY_MISMATCH") {
      throw new TeacherJekoPayoutError(
        "Cette clé d'idempotence appartient à un autre retrait.",
        409,
        errorCode,
      );
    }
    if (errorCode === "P2002") {
      const raced = await db.teacherPayoutRecord.findUnique({ where: { id: payoutRecordId } });
      if (raced) {
        if (!payoutRecordMatches(raced, {
          teacherId: teacher.id,
          amount,
          method: input.method,
          paymentPhone,
          reference: payoutReference,
        })) {
          throw new TeacherJekoPayoutError(
            "Cette clé d'idempotence appartient à un autre retrait.",
            409,
            "PAYOUT_IDEMPOTENCY_MISMATCH",
          );
        }
        if (raced.status === "CANCELLED") {
          throw new TeacherJekoPayoutError(
            "La tentative précédente a échoué sans débit. Relancez avec une nouvelle demande.",
            409,
            "PAYOUT_PREVIOUS_ATTEMPT_CANCELLED",
            raced.id,
          );
        }
        return processJekoTeacherPayoutRecord(raced.id);
      }
      throw new TeacherJekoPayoutError(
        "Cette demande de retrait est déjà en cours.",
        409,
        "PAYOUT_IDEMPOTENCY_RACE",
      );
    }
    throw error;
  }

  return processJekoTeacherPayoutRecord(payoutRecordId);
}

function getErrorCode(error: unknown) {
  if (error && typeof error === "object") {
    if ("code" in error && typeof error.code === "string") return error.code;
    if ("message" in error && typeof error.message === "string") return error.message;
  }
  return "UNKNOWN";
}

function payoutRecordMatches(
  record: {
    teacherId: string;
    amount: number;
    method: PaymentMethod | null;
    paymentPhone: string | null;
    reference: string;
    providerReference: string | null;
  },
  expected: {
    teacherId: string;
    amount: number;
    method: PaymentMethod;
    paymentPhone: string;
    reference: string;
  },
) {
  return record.teacherId === expected.teacherId
    && record.amount === expected.amount
    && record.method === expected.method
    && record.paymentPhone === expected.paymentPhone
    && record.reference === expected.reference
    && record.providerReference === expected.reference;
}

function appliedAdjustmentFingerprint(
  adjustments: Array<{
    id: string;
    amount: number;
    bookingId: string | null;
  }>,
) {
  return adjustments
    .map((adjustment) => `${adjustment.id}:${adjustment.bookingId ?? "GLOBAL"}:${adjustment.amount}`)
    .sort()
    .join("|");
}
