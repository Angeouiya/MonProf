import { NextRequest, NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api";
import { ACTIVE_PAYMENT_METHODS, paymentMethodLabel } from "@/lib/payment-methods";
import { hasVerifiedPayDunyaClientPayment } from "@/lib/payment-security";
import {
  getTeacherGlobalRetentionLedger,
  getTeacherPayableAmount,
  isCancellationPenaltyPayout,
} from "@/lib/teacher-payments";
import { lockTeacherPayoutBalance } from "@/lib/teacher-payout-reservations";
import {
  buildJekoPayoutRecordId,
  getStableJekoPayoutReference,
  processJekoTeacherPayoutRecord,
  type JekoPayoutReconciliationResult,
} from "@/lib/jeko-payout-reconciliation";

const PAYMENT_METHODS: readonly PaymentMethod[] = ACTIVE_PAYMENT_METHODS;
const MAX_REFERENCE_LENGTH = 80;
const MAX_NOTE_LENGTH = 500;

function parseAmount(value: unknown) {
  if (typeof value === "number") return Math.round(value);
  if (typeof value === "string") return Math.round(Number(value.replace(/\s/g, "")));
  return 0;
}

function normalizePhone(value: unknown) {
  return typeof value === "string" ? value.replace(/[^\d+]/g, "").trim() : "";
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi("FINANCE_MANAGE");
  if (!admin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const body = await req.json();
  const teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
  const targetBookingId = typeof body.bookingId === "string" && body.bookingId.trim() ? body.bookingId.trim() : null;
  const requestId = typeof body.requestId === "string" && body.requestId.trim() ? body.requestId.trim() : null;
  const amount = parseAmount(body.amount);
  const method = typeof body.method === "string" && PAYMENT_METHODS.includes(body.method as PaymentMethod)
    ? (body.method as PaymentMethod)
    : undefined;
  const requestedPaymentPhone = normalizePhone(body.paymentPhone);
  const requestedPaymentPhoneConfirm = normalizePhone(body.paymentPhoneConfirm);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const operatorReference = typeof body.reference === "string" ? body.reference.trim() : "";
  const rawIdempotencyKey = typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
    ? body.idempotencyKey.trim()
    : req.headers.get("idempotency-key")?.trim() ?? "";

  if (!teacherId) {
    return NextResponse.json({ error: "Professeur requis." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Montant de paiement invalide." }, { status: 400 });
  }
  if (!method) {
    return NextResponse.json({ error: "Choisissez le moyen de paiement professeur." }, { status: 400 });
  }
  if (operatorReference.length > MAX_REFERENCE_LENGTH) {
    return NextResponse.json({ error: `Référence trop longue (${MAX_REFERENCE_LENGTH} caractères maximum).` }, { status: 400 });
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: `Note interne trop longue (${MAX_NOTE_LENGTH} caractères maximum).` }, { status: 400 });
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
    return NextResponse.json({ error: "Professeur introuvable." }, { status: 404 });
  }

  // Une réservation conserve son professeur d'origine, mais chaque séance peut être
  // réattribuée. Ces dossiers doivent donc entrer dans la comptabilité du remplaçant.
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

  const payoutRequest = requestId
    ? await db.teacherPayoutRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          reference: true,
          teacherId: true,
          amount: true,
          method: true,
          paymentPhone: true,
          status: true,
          payoutRecordId: true,
        },
      })
    : null;

  if (requestId && !payoutRequest) {
    return NextResponse.json({ error: "Demande de paiement introuvable." }, { status: 404 });
  }
  if (payoutRequest && payoutRequest.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Cette demande de paiement n'appartient pas à ce professeur." }, { status: 400 });
  }
  if (payoutRequest?.status === "PAID" && payoutRequest.payoutRecordId) {
    const result = await processJekoTeacherPayoutRecord(payoutRequest.payoutRecordId);
    return payoutResultResponse(result);
  }
  if (payoutRequest && payoutRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Cette demande de paiement a déjà été traitée." }, { status: 400 });
  }
  if (payoutRequest && payoutRequest.amount !== amount) {
    return NextResponse.json({ error: `La demande ${payoutRequest.reference} porte sur ${payoutRequest.amount} FCFA. Enregistrez ce montant ou désélectionnez la demande.` }, { status: 400 });
  }
  if (payoutRequest && payoutRequest.method !== method) {
    return NextResponse.json({
      error: `La demande ${payoutRequest.reference} a été faite via ${paymentMethodLabel(payoutRequest.method)}. Désélectionnez-la pour utiliser un autre moyen de paiement.`,
    }, { status: 400 });
  }

  const paymentPhone = payoutRequest?.paymentPhone ?? requestedPaymentPhone;
  if (paymentPhone.length < 8 || paymentPhone.length > 20) {
    return NextResponse.json({ error: "Numéro de paiement professeur requis et invalide." }, { status: 400 });
  }
  if (!payoutRequest) {
    if (!requestedPaymentPhoneConfirm) {
      return NextResponse.json({ error: "Confirmez le numéro de paiement professeur." }, { status: 400 });
    }
    if (paymentPhone !== requestedPaymentPhoneConfirm) {
      return NextResponse.json({ error: "Les deux numéros de paiement ne correspondent pas." }, { status: 400 });
    }
  }

  if (!payoutRequest && !rawIdempotencyKey) {
    return NextResponse.json({ error: "Clé d'idempotence requise pour sécuriser le versement." }, { status: 400 });
  }
  let payoutRecordId: string;
  try {
    payoutRecordId = payoutRequest
      ? await resolvePayoutRequestAttemptId(payoutRequest.id)
      : buildJekoPayoutRecordId(rawIdempotencyKey);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Clé d'idempotence invalide.",
    }, { status: 400 });
  }

  const payoutReference = getStableJekoPayoutReference(payoutRecordId);
  const existingPayout = await db.teacherPayoutRecord.findUnique({ where: { id: payoutRecordId } });
  if (existingPayout) {
    if (!payoutRecordMatches(existingPayout, {
      teacherId: teacher.id,
      amount,
      method,
      paymentPhone,
      reference: payoutReference,
    })) {
      return NextResponse.json({ error: "Cette clé d'idempotence appartient à un autre versement." }, { status: 409 });
    }
    if (existingPayout.status === "CANCELLED") {
      return NextResponse.json({
        error: "La tentative précédente a échoué sans débit. Relancez avec une nouvelle clé d'idempotence.",
        payoutRecordId: existingPayout.id,
      }, { status: 409 });
    }
    const result = await processJekoTeacherPayoutRecord(existingPayout.id);
    return payoutResultResponse(result);
  }

  // Une reprise idempotente doit toujours retrouver son DRAFT/PAID avant
  // d'examiner les nouvelles demandes. La file FIFO ne s'applique qu'à la
  // création d'une nouvelle allocation.
  const oldestUnallocatedRequest = await db.teacherPayoutRequest.findFirst({
    where: {
      teacherId: teacher.id,
      status: "PENDING",
      payoutRecordId: null,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, reference: true },
  });
  if (!payoutRequest && oldestUnallocatedRequest) {
    return NextResponse.json({
      error: `Le solde est déjà réservé par la demande ${oldestUnallocatedRequest.reference}. Traitez ou rejetez d'abord les demandes professeur en attente.`,
      code: "PENDING_PAYOUT_REQUEST_RESERVED",
    }, { status: 409 });
  }
  if (
    payoutRequest
    && !payoutRequest.payoutRecordId
    && oldestUnallocatedRequest?.id !== payoutRequest.id
  ) {
    return NextResponse.json({
      error: oldestUnallocatedRequest
        ? `Traitez d'abord la demande professeur la plus ancienne (${oldestUnallocatedRequest.reference}).`
        : "Cette demande n'est plus disponible pour un versement.",
      code: "PAYOUT_REQUEST_QUEUE_CHANGED",
    }, { status: 409 });
  }

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
    retainedAmount: number;
    remaining: number;
  };
  const dueItems: DueItem[] = [];

  for (const booking of teacherBookings.filter((item) => hasVerifiedPayDunyaClientPayment(item))) {
    const cancellationPenaltyPayout = isCancellationPenaltyPayout(booking);
    if (booking._count.sessions > 0 && !cancellationPenaltyPayout) {
      // Dès qu'un ledger par séance existe, il est la seule source de
      // vérité. Une liste vide signifie que ce professeur ne possède plus
      // aucune séance payable (par exemple après remplacement partiel) ; il
      // ne faut surtout pas retomber sur teacherNetAmount au niveau Booking.
      if (booking.sessions.length === 0) continue;
      const persistedBookingRetention = booking.sessions.reduce(
        (sum, session) => sum + Math.max(0, session.retainedAmount),
        0,
      );
      let bookingRetentionLeft = Math.max(0, teacher.paymentAdjustments
        .filter((adjustment) => adjustment.bookingId === booking.id)
        .reduce((sum, adjustment) => sum + Math.max(0, adjustment.amount), 0) - persistedBookingRetention);

      for (const session of booking.sessions) {
        const payableAmount = Math.max(0, session.releasedAmount);
        const paid = Math.min(payableAmount, Math.max(0, session.paidAmount));
        const grossRemaining = Math.max(0, payableAmount - paid);
        const bookingRetention = Math.min(grossRemaining, bookingRetentionLeft);
        bookingRetentionLeft -= bookingRetention;
        const globalRetention = Math.min(Math.max(0, grossRemaining - bookingRetention), globalRetentionLeft);
        globalRetentionLeft -= globalRetention;
        const retainedAmount = Math.min(
          grossRemaining,
          Math.max(0, session.retainedAmount) + bookingRetention + globalRetention,
        );
        if (grossRemaining > 0 || retainedAmount > 0) {
          const reservedAmount = reservedByItem.get(session.id) ?? 0;
          dueItems.push({
            booking,
            session,
            payableAmount,
            paid,
            retainedAmount,
            // Un DRAFT fige le snapshot de toute la ligne. Une seconde
            // tentative doit passer à la ligne suivante plutôt que partager
            // un même snapshot paid/released avec un transfert asynchrone.
            remaining: reservedAmount > 0 ? 0 : Math.max(0, grossRemaining - retainedAmount),
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
    // Un snapshot legacy DRAFT/PAID affecte durablement une part de la
    // retenue globale à ce booking. Elle doit rester soustraite après un
    // paiement partiel, même si elle n'a pas de colonne retainedAmount.
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
        retainedAmount,
        remaining: reservedAmount > 0 ? 0 : Math.max(0, grossRemaining - retainedAmount),
      });
    }
  }
  const allocationCandidates = targetBookingId
    ? dueItems.filter((item) => item.booking.id === targetBookingId)
    : dueItems;
  const totalDue = allocationCandidates.reduce((sum, item) => sum + item.remaining, 0);

  if (targetBookingId && allocationCandidates.length === 0) {
    return NextResponse.json({ error: "Cette réservation n'est pas payable pour ce professeur ou n'a plus de reste dû." }, { status: 400 });
  }

  if (totalDue <= 0) {
    return NextResponse.json({ error: targetBookingId ? "Aucun reste net à payer sur cette réservation après retenues appliquées." : "Aucun montant net à payer pour ce professeur après retenues appliquées." }, { status: 400 });
  }
  if (amount > totalDue) {
    return NextResponse.json({
      error: `Le montant dépasse le net à payer après retenues (${totalDue} FCFA).`,
    }, { status: 400 });
  }

  let remainingPayment = amount;
  const allocations: { item: (typeof dueItems)[number]; amount: number }[] = [];
  for (const item of allocationCandidates) {
    if (remainingPayment <= 0) break;
    const allocated = Math.min(item.remaining, remainingPayment);
    if (allocated <= 0) continue;
    allocations.push({ item, amount: allocated });
    remainingPayment -= allocated;
  }

  const teacherName = teacher.professionalName || teacher.fullName;
  const draftNote = [
    note,
    operatorReference ? `[INTERNE] Référence saisie par l'administrateur : ${operatorReference}` : "",
    "[INTERNE] Transfert automatisé Jèko : le ledger professeur ne sera débité qu'après confirmation finale.",
  ].filter(Boolean).join("\n");
  try {
    await db.$transaction(async (tx) => {
      // Premier verrou de toute mutation du solde professeur. Une retenue
      // APPLIED utilise exactement le même mutex et le même ordre.
      await lockTeacherPayoutBalance(tx, teacher.id);

      const existing = await tx.teacherPayoutRecord.findUnique({ where: { id: payoutRecordId } });
      if (existing) {
        if (!payoutRecordMatches(existing, {
          teacherId: teacher.id,
          amount,
          method,
          paymentPhone,
          reference: payoutReference,
        })) {
          throw new Error("PAYOUT_IDEMPOTENCY_MISMATCH");
        }
        return existing;
      }

      // Le calcul d'allocation a volontairement lieu avant la transaction
      // pour rester court. Sous le verrou, sa source APPLIED doit donc être
      // relue et correspondre exactement au snapshot utilisé.
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

      const currentOldestUnallocatedRequest = await tx.teacherPayoutRequest.findFirst({
        where: {
          teacherId: teacher.id,
          status: "PENDING",
          payoutRecordId: null,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      if (payoutRequest) {
        if (currentOldestUnallocatedRequest?.id !== payoutRequest.id) {
          throw new Error("PAYOUT_REQUEST_QUEUE_CHANGED");
        }
      } else if (currentOldestUnallocatedRequest) {
        throw new Error("PENDING_PAYOUT_REQUEST_RESERVED");
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
          const current = await tx.bookingSession.findUnique({ where: { id: item.session.id } });
          if (
            !current
            || current.teacherId !== teacher.id
            || current.paidAmount !== item.session.paidAmount
            || current.releasedAmount !== item.session.releasedAmount
            || current.retainedAmount !== item.session.retainedAmount
          ) {
            throw new Error("PAYOUT_BALANCE_CHANGED");
          }
          // Une retenue APPLIED est indépendante du transfert. La matérialiser
          // ici ne débite pas teacherPaid et fige le snapshot du futur succès.
          if (item.retainedAmount !== current.retainedAmount) {
            const retained = await tx.bookingSession.updateMany({
              where: {
                id: current.id,
                paidAmount: current.paidAmount,
                releasedAmount: current.releasedAmount,
                retainedAmount: current.retainedAmount,
              },
              data: { retainedAmount: item.retainedAmount },
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
          method,
          paymentPhone,
          provider: "JEKO",
          providerReference: payoutReference,
          transferFeeAmount: 0,
          transferFeeCoveredByPlatform: 0,
          note: draftNote || null,
          status: "DRAFT",
          createdById: admin.id,
          allocations: {
            create: allocations.map((allocation) => ({
              bookingId: allocation.item.booking.id,
              bookingSessionId: allocation.item.session?.id ?? null,
              amount: allocation.amount,
              paidAmountBefore: allocation.item.paid,
              releasedAmountSnapshot: allocation.item.payableAmount,
              retainedAmountSnapshot: allocation.item.retainedAmount,
            })),
          },
        },
      });

      if (payoutRequest) {
        const claimedRequest = await tx.teacherPayoutRequest.updateMany({
          where: { id: payoutRequest.id, status: "PENDING", payoutRecordId: null },
          data: {
            payoutRecordId: record.id,
            adminNote: `Transfert Jèko initialisé sous ${record.reference}. Le solde reste inchangé tant que Jèko n'a pas confirmé le succès.`,
          },
        });
        if (claimedRequest.count !== 1) throw new Error("PAYOUT_REQUEST_ALREADY_HANDLED");
      }

      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          action: "Versement professeur Jèko initié",
          entityType: "TeacherPayoutRecord",
          entityId: record.id,
          detail: `${admin.name} a initié ${amount} FCFA pour ${teacherName}. Les ${allocations.length} allocation(s) sont réservées sans débit du ledger.`,
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
      "PAYOUT_REQUEST_ALREADY_HANDLED",
      "PAYOUT_REQUEST_QUEUE_CHANGED",
      "PENDING_PAYOUT_REQUEST_RESERVED",
      "TEACHER_PAYOUT_LOCK_NOT_FOUND",
    ].includes(errorCode)) {
      return NextResponse.json({
        error: "Le solde ou la demande vient d'être modifié par une autre action. Actualisez la comptabilité avant de valider à nouveau.",
      }, { status: 409 });
    }
    if (errorCode === "PAYOUT_IDEMPOTENCY_MISMATCH") {
      return NextResponse.json({
        error: "Cette clé d'idempotence appartient à un autre versement.",
      }, { status: 409 });
    }
    if (errorCode === "P2002") {
      const raced = await db.teacherPayoutRecord.findUnique({ where: { id: payoutRecordId } });
      if (raced) {
        if (!payoutRecordMatches(raced, {
          teacherId: teacher.id,
          amount,
          method,
          paymentPhone,
          reference: payoutReference,
        })) {
          return NextResponse.json({
            error: "Cette clé d'idempotence appartient à un autre versement.",
          }, { status: 409 });
        }
        if (raced.status === "CANCELLED") {
          return NextResponse.json({
            error: "La tentative précédente a échoué sans débit. Relancez avec une nouvelle clé d'idempotence.",
            payoutRecordId: raced.id,
          }, { status: 409 });
        }
        return payoutResultResponse(await processJekoTeacherPayoutRecord(raced.id));
      }
      return NextResponse.json({ error: "Cette demande de paiement a déjà été utilisée." }, { status: 409 });
    }
    throw error;
  }

  return payoutResultResponse(await processJekoTeacherPayoutRecord(payoutRecordId));
}

function payoutResultResponse(result: JekoPayoutReconciliationResult) {
  if (result.action === "paid" || result.action === "already_paid") {
    return NextResponse.json({ ok: true, pending: false, payout: result });
  }
  if (result.action === "pending" || result.action === "duplicate") {
    return NextResponse.json({ ok: true, pending: true, payout: result }, { status: 202 });
  }
  const status = result.action === "not_found" ? 404 : result.action === "rejected" ? 409 : 422;
  return NextResponse.json({
    ok: false,
    pending: false,
    error: result.message,
    payout: result,
  }, { status });
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

async function resolvePayoutRequestAttemptId(requestId: string) {
  const prefix = `teacher-payout-request:${requestId}`;
  for (let attemptNumber = 1; attemptNumber <= 50; attemptNumber += 1) {
    // Conserver l'identifiant historique pour la première tentative permet de
    // reprendre sans rupture les DRAFT déjà créés avant le versionnement.
    const source = attemptNumber === 1 ? prefix : `${prefix}:attempt:${attemptNumber}`;
    const id = buildJekoPayoutRecordId(source);
    const existing = await db.teacherPayoutRecord.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing || existing.status !== "CANCELLED") return id;
  }
  throw new Error("Trop de tentatives annulées pour cette demande de paiement.");
}
